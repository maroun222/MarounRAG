using Microsoft.AspNetCore.Mvc;
using RagMiddleware.Application.Abstractions;
using RagMiddleware.Application.Abstractions.Persistence;
using RagMiddleware.Application.Contracts;
using RagMiddleware.Domain.Entities;

using System.Text;
using System.Text.Json;

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
Sources = response.Sources
    .Select(
        source =>
            new ConversationSource
            {
                CitationId =
                    source.CitationId,
                Document =
                    source.Document,
                Page =
                    source.Page,
                Snippet =
                    source.Snippet
            }
    )
    .ToArray(),
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

    string? userId = null;

    string? conversationId =
        request.ConversationId?.Trim();

    /*
     * Validate the conversation before starting the stream.
     * Do not save messages until a complete answer is received.
     */
    if (!string.IsNullOrWhiteSpace(conversationId))
    {
        userId = GetCurrentUserId();

        if (userId is null)
        {
            Response.StatusCode =
                StatusCodes.Status401Unauthorized;

            await Response.WriteAsJsonAsync(
                new
                {
                    error = (
                        $"The {UserIdHeaderName} header is " +
                        "required during development."
                    )
                },
                cancellationToken
            );

            return;
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
            Response.StatusCode =
                StatusCodes.Status404NotFound;

            await Response.WriteAsJsonAsync(
                new
                {
                    error = "Conversation not found."
                },
                cancellationToken
            );

            return;
        }
    }

    var streamCapture = new RagStreamCapture();

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

        using var reader =
            new StreamReader(upstreamStream);

        string currentEvent = "message";

        List<string> dataLines = [];

        while (true)
        {
            string? line =
                await reader.ReadLineAsync(
                    cancellationToken
                );

            if (line is null)
            {
                /*
                 * Process a final event even if the upstream
                 * stream did not end with a blank line.
                 */
                if (dataLines.Count > 0)
                {
                    streamCapture.ProcessEvent(
                        currentEvent,
                        string.Join(
                            "\n",
                            dataLines
                        )
                    );
                }

                break;
            }

            /*
             * Forward every SSE line to React.
             */
            await Response.WriteAsync(
                line + "\n",
                cancellationToken
            );

            /*
             * A blank line marks the end of one SSE event.
             */
            if (line.Length == 0)
            {
                if (dataLines.Count > 0)
                {
                    streamCapture.ProcessEvent(
                        currentEvent,
                        string.Join(
                            "\n",
                            dataLines
                        )
                    );
                }

                currentEvent = "message";
                dataLines.Clear();

                await Response.Body.FlushAsync(
                    cancellationToken
                );

                continue;
            }

            if (
                line.StartsWith(
                    "event:",
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                currentEvent =
                    line["event:".Length..].Trim();

                continue;
            }

            if (
                line.StartsWith(
                    "data:",
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                dataLines.Add(
                    line["data:".Length..]
                        .TrimStart()
                );
            }
        }

        /*
         * Persist only a fully completed answer.
         *
         * Failed or interrupted streams do not create partial
         * conversation messages.
         */
        if (
            streamCapture.Completed &&
            streamCapture.Answer.Length > 0 &&
            !string.IsNullOrWhiteSpace(
                conversationId
            ) &&
            userId is not null
        )
        {
            DateTime userMessageTime =
                DateTime.UtcNow;

            DateTime assistantMessageTime =
                userMessageTime.AddMilliseconds(1);

            var userMessage = new ConversationMessage
            {
                Id = Guid.NewGuid().ToString("N"),
                ConversationId = conversationId,
                UserId = userId,
                Role = "user",
                Content = request.Message.Trim(),
                CreatedAtUtc = userMessageTime
            };

            var assistantMessage =
                new ConversationMessage
                {
                    Id = Guid.NewGuid().ToString("N"),
                    ConversationId = conversationId,
                    UserId = userId,
                    Role = "assistant",
                    Content =
                        streamCapture.Answer.ToString(),
                    Page = streamCapture.Page,
                    Context = streamCapture.Context,
                    RetrievalContext =
    streamCapture.RetrievalContext,
Sources =
    streamCapture.Sources.ToArray(),
CacheHit = streamCapture.CacheHit,
                    Timings = streamCapture.Timings,
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
    }
    catch (OperationCanceledException)
        when (
            HttpContext.RequestAborted
                .IsCancellationRequested
        )
    {
        /*
         * Do not save partial messages when the browser
         * disconnects before the stream finishes.
         */
        _logger.LogInformation(
            "The client disconnected from the RAG stream."
        );
    }
    catch (Exception exception)
        when (
            exception is HttpRequestException
            or InvalidOperationException
            or TaskCanceledException
            or JsonException
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
        else
        {
            string errorPayload =
                JsonSerializer.Serialize(
                    new
                    {
                        message = (
                            "The RAG stream was interrupted."
                        )
                    }
                );

            await Response.WriteAsync(
                $"event: error\n" +
                $"data: {errorPayload}\n\n",
                cancellationToken
            );

            await Response.Body.FlushAsync(
                cancellationToken
            );
        }
    }
    finally
    {
        upstreamResponse?.Dispose();
    }
}

private sealed class RagStreamCapture
{
    public StringBuilder Answer { get; } = new();

    public int? Page { get; private set; }

    public string? Context { get; private set; }

    public List<string> RetrievalContext {
        get;
    } = [];

    public List<ConversationSource> Sources
    {
        get;
    } = [];

    public bool? CacheHit { get; private set; }

    public Dictionary<string, double> Timings {
        get;
    } = [];

    public bool Completed { get; private set; }

    public void ProcessEvent(
        string eventName,
        string rawData
    )
    {
        if (string.IsNullOrWhiteSpace(rawData))
        {
            return;
        }

        using JsonDocument document =
            JsonDocument.Parse(rawData);

        JsonElement root =
            document.RootElement;

        if (
            eventName.Equals(
                "token",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            if (
                root.TryGetProperty(
                    "text",
                    out JsonElement textElement
                ) &&
                textElement.ValueKind ==
                    JsonValueKind.String
            )
            {
                Answer.Append(
                    textElement.GetString()
                );
            }

            return;
        }

        if (
            eventName.Equals(
                "done",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            Completed = true;

            /*
             * Support a future backend that may include the
             * complete answer in the done event.
             */
            if (
                Answer.Length == 0 &&
                root.TryGetProperty(
                    "answer",
                    out JsonElement answerElement
                ) &&
                answerElement.ValueKind ==
                    JsonValueKind.String
            )
            {
                Answer.Append(
                    answerElement.GetString()
                );
            }
        }

        CaptureMetadata(root);
    }

    private void CaptureMetadata(
        JsonElement element
    )
    {
        if (
            element.ValueKind !=
            JsonValueKind.Object
        )
        {
            return;
        }

        if (
            element.TryGetProperty(
                "metadata",
                out JsonElement metadataElement
            )
        )
        {
            CaptureMetadata(metadataElement);
        }

        if (
            element.TryGetProperty(
                "page",
                out JsonElement pageElement
            ) &&
            pageElement.ValueKind ==
                JsonValueKind.Number &&
            pageElement.TryGetInt32(
                out int parsedPage
            )
        )
        {
            Page = parsedPage;
        }

        if (
            element.TryGetProperty(
                "context",
                out JsonElement contextElement
            ) &&
            contextElement.ValueKind ==
                JsonValueKind.String
        )
        {
            Context =
                contextElement.GetString();
        }

        if (
            element.TryGetProperty(
                "retrieval_context",
                out JsonElement retrievalElement
            ) &&
            retrievalElement.ValueKind ==
                JsonValueKind.Array
        )
        {
            RetrievalContext.Clear();

            foreach (
                JsonElement item
                in retrievalElement.EnumerateArray()
            )
            {
                if (
                    item.ValueKind ==
                    JsonValueKind.String
                )
                {
                    RetrievalContext.Add(
                        item.GetString() ??
                        string.Empty
                    );
                }
            }
        }
        if (
            element.TryGetProperty(
                "sources",
                out JsonElement sourcesElement
            ) &&
            sourcesElement.ValueKind ==
                JsonValueKind.Array
        )
        {
            CaptureSources(sourcesElement);
        }

        if (
            element.TryGetProperty(
                "cache_hit",
                out JsonElement cacheElement
            ) &&
            (
                cacheElement.ValueKind ==
                    JsonValueKind.True ||
                cacheElement.ValueKind ==
                    JsonValueKind.False
            )
        )
        {
            CacheHit =
                cacheElement.GetBoolean();
        }

        if (
            element.TryGetProperty(
                "timings",
                out JsonElement timingsElement
            ) &&
            timingsElement.ValueKind ==
                JsonValueKind.Object
        )
        {
            Timings.Clear();

            foreach (
                JsonProperty property
                in timingsElement.EnumerateObject()
            )
            {
                if (
                    property.Value.ValueKind ==
                        JsonValueKind.Number &&
                    property.Value.TryGetDouble(
                        out double value
                    )
                )
                {
                    Timings[property.Name] =
                        value;
                }
            }
        }
    }
    private void CaptureSources(
        JsonElement sourcesElement
    )
    {
        Sources.Clear();

        foreach (
            JsonElement sourceElement
            in sourcesElement.EnumerateArray()
        )
        {
            if (
                sourceElement.ValueKind !=
                JsonValueKind.Object
            )
            {
                continue;
            }

            int citationId = 0;

            if (
                sourceElement.TryGetProperty(
                    "citation_id",
                    out JsonElement citationElement
                ) &&
                citationElement.ValueKind ==
                    JsonValueKind.Number
            )
            {
                citationElement.TryGetInt32(
                    out citationId
                );
            }

            string documentName =
                string.Empty;

            if (
                sourceElement.TryGetProperty(
                    "document",
                    out JsonElement documentElement
                ) &&
                documentElement.ValueKind ==
                    JsonValueKind.String
            )
            {
                documentName =
                    documentElement.GetString()
                    ?? string.Empty;
            }

            int? page = null;

            if (
                sourceElement.TryGetProperty(
                    "page",
                    out JsonElement pageElement
                ) &&
                pageElement.ValueKind ==
                    JsonValueKind.Number &&
                pageElement.TryGetInt32(
                    out int parsedPage
                )
            )
            {
                page = parsedPage;
            }

            string snippet =
                string.Empty;

            if (
                sourceElement.TryGetProperty(
                    "snippet",
                    out JsonElement snippetElement
                ) &&
                snippetElement.ValueKind ==
                    JsonValueKind.String
            )
            {
                snippet =
                    snippetElement.GetString()
                    ?? string.Empty;
            }

            Sources.Add(
                new ConversationSource
                {
                    CitationId = citationId,
                    Document = documentName,
                    Page = page,
                    Snippet = snippet
                }
            );
        }
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