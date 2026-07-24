using Microsoft.AspNetCore.Mvc;
using RagMiddleware.Application.Abstractions;
using RagMiddleware.Application.Abstractions.Persistence;
using RagMiddleware.Application.Contracts;
using RagMiddleware.Domain.Entities;

namespace RagMiddleware.Api.Controllers;

[ApiController]
[Route("api/rag")]
public sealed class RagController : ControllerBase
{
    private const string UserIdHeaderName = "X-User-Id";

    private readonly IRagApiClient _ragApiClient;

    private readonly IConversationRepository
        _conversationRepository;

    private readonly ILogger<RagController> _logger;

    public RagController(
        IRagApiClient ragApiClient,
        IConversationRepository conversationRepository,
        ILogger<RagController> logger
    )
    {
        _ragApiClient = ragApiClient;
        _conversationRepository = conversationRepository;
        _logger = logger;
    }

    // ========================================================
    // Normal non-streaming query
    // ========================================================

    [HttpPost("query")]
[ProducesResponseType<RagQueryResponse>(
    StatusCodes.Status200OK
)]
[ProducesResponseType(
    StatusCodes.Status401Unauthorized
)]
[ProducesResponseType(
    StatusCodes.Status404NotFound
)]
[ProducesResponseType(
    StatusCodes.Status502BadGateway
)]
[ProducesResponseType(
    StatusCodes.Status504GatewayTimeout
)]
public async Task<ActionResult<RagQueryResponse>> Query(
    [FromBody] RagQueryRequest request,
    CancellationToken cancellationToken
)
{
    string? userId = null;

    string? conversationId =
        request.ConversationId?.Trim();

    /*
     * Validate conversation ownership before calling the
     * Python API, but do not save anything yet.
     */
    if (!string.IsNullOrWhiteSpace(conversationId))
    {
        userId = GetCurrentUserId();

        if (userId is null)
        {
            return Unauthorized(
                new
                {
                    error = (
                        $"The {UserIdHeaderName} header is " +
                        "required during development."
                    )
                }
            );
        }

        Conversation? conversation =
            await _conversationRepository
                .GetConversationAsync(
                    conversationId,
                    userId,
                    cancellationToken
                );

        if (conversation is null)
        {
            return NotFound(
                new
                {
                    error = "Conversation not found."
                }
            );
        }
    }

    try
    {
        /*
         * Generate the answer first.
         *
         * If Python fails, no user or assistant message is
         * stored in MongoDB.
         */
        RagQueryResponse response =
            await _ragApiClient.QueryAsync(
                request,
                cancellationToken
            );

        /*
         * Persist both messages only after successful RAG
         * generation.
         */
        if (
            !string.IsNullOrWhiteSpace(conversationId) &&
            userId is not null
        )
        {
            DateTime userMessageTime =
                DateTime.UtcNow;

            var userMessage = new ConversationMessage
            {
                Id = Guid.NewGuid().ToString("N"),
                ConversationId = conversationId,
                UserId = userId,
                Role = "user",
                Content = request.Message.Trim(),
                CreatedAtUtc = userMessageTime
            };

            DateTime assistantMessageTime =
                DateTime.UtcNow;

            var assistantMessage =
                new ConversationMessage
                {
                    Id = Guid.NewGuid().ToString("N"),
                    ConversationId = conversationId,
                    UserId = userId,
                    Role = "assistant",
                    Content = response.Answer,
                    Page = response.Page,
                    Context = response.Context,
                    RetrievalContext =
                        response.RetrievalContext,
                    CacheHit = response.CacheHit,
                    Timings = response.Timings,
                    CreatedAtUtc =
                        assistantMessageTime
                };

            await _conversationRepository
                .AddMessageAsync(
                    userMessage,
                    cancellationToken
                );

            await _conversationRepository
                .AddMessageAsync(
                    assistantMessage,
                    cancellationToken
                );

            await _conversationRepository
                .UpdateConversationTimestampAsync(
                    conversationId,
                    userId,
                    assistantMessageTime,
                    cancellationToken
                );
        }

        return Ok(response);
    }
    catch (TaskCanceledException exception)
        when (
            !HttpContext.RequestAborted
                .IsCancellationRequested
        )
    {
        _logger.LogError(
            exception,
            "The Python RAG API request timed out."
        );

        return StatusCode(
            StatusCodes.Status504GatewayTimeout,
            new
            {
                error = "The RAG service timed out."
            }
        );
    }
    catch (Exception exception)
        when (
            exception is HttpRequestException
            or InvalidOperationException
        )
    {
        _logger.LogError(
            exception,
            "The Python RAG API request failed."
        );

        return StatusCode(
            StatusCodes.Status502BadGateway,
            new
            {
                error = "The RAG service is unavailable."
            }
        );
    }
}

    // ========================================================
    // SSE streaming query
    // ========================================================

    [HttpPost("query/stream")]
    [Produces("text/event-stream")]
    public async Task StreamQuery(
        [FromBody] RagQueryRequest request,
        CancellationToken cancellationToken
    )
    {
        HttpResponseMessage? upstreamResponse = null;

        try
        {
            upstreamResponse =
                await _ragApiClient.StreamQueryAsync(
                    request,
                    cancellationToken
                );

            if (!upstreamResponse.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "Python RAG streaming request failed " +
                    "with status {StatusCode}.",
                    upstreamResponse.StatusCode
                );

                Response.StatusCode =
                    StatusCodes.Status502BadGateway;

                await Response.WriteAsJsonAsync(
                    new
                    {
                        error =
                            "The RAG service is unavailable."
                    },
                    cancellationToken
                );

                return;
            }

            Response.StatusCode =
                StatusCodes.Status200OK;

            Response.ContentType =
                "text/event-stream";

            Response.Headers["Cache-Control"] =
                "no-cache";

            Response.Headers["X-Accel-Buffering"] =
                "no";

            await Response.StartAsync(
                cancellationToken
            );

            await using Stream upstreamStream =
                await upstreamResponse.Content
                    .ReadAsStreamAsync(
                        cancellationToken
                    );

            byte[] buffer = new byte[8192];

            while (true)
            {
                int bytesRead =
                    await upstreamStream.ReadAsync(
                        buffer.AsMemory(
                            0,
                            buffer.Length
                        ),
                        cancellationToken
                    );

                if (bytesRead == 0)
                {
                    break;
                }

                await Response.Body.WriteAsync(
                    buffer.AsMemory(
                        0,
                        bytesRead
                    ),
                    cancellationToken
                );

                await Response.Body.FlushAsync(
                    cancellationToken
                );
            }
        }
        catch (OperationCanceledException)
            when (
                HttpContext.RequestAborted
                    .IsCancellationRequested
            )
        {
            _logger.LogInformation(
                "The client disconnected from the RAG stream."
            );
        }
        catch (Exception exception)
            when (
                exception is HttpRequestException
                or InvalidOperationException
                or TaskCanceledException
            )
        {
            _logger.LogError(
                exception,
                "The Python RAG streaming request failed."
            );

            if (!Response.HasStarted)
            {
                Response.StatusCode =
                    StatusCodes.Status502BadGateway;

                await Response.WriteAsJsonAsync(
                    new
                    {
                        error = (
                            "The RAG streaming service " +
                            "is unavailable."
                        )
                    },
                    cancellationToken
                );
            }
        }
        finally
        {
            upstreamResponse?.Dispose();
        }
    }

    // ========================================================
    // Helpers
    // ========================================================

    private string? GetCurrentUserId()
    {
        string value =
            Request.Headers[UserIdHeaderName]
                .FirstOrDefault()
                ?.Trim()
            ?? string.Empty;

        return string.IsNullOrWhiteSpace(value)
            ? null
            : value;
    }
}