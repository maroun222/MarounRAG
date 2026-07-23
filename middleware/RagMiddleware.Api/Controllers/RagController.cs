using Microsoft.AspNetCore.Mvc;
using RagMiddleware.Application.Abstractions;
using RagMiddleware.Application.Contracts;

namespace RagMiddleware.Api.Controllers;

[ApiController]
[Route("api/rag")]
public sealed class RagController : ControllerBase
{
    private readonly IRagApiClient _ragApiClient;
    private readonly ILogger<RagController> _logger;

    public RagController(
        IRagApiClient ragApiClient,
        ILogger<RagController> logger
    )
    {
        _ragApiClient = ragApiClient;
        _logger = logger;
    }

    [HttpPost("query")]
    [ProducesResponseType<RagQueryResponse>(
        StatusCodes.Status200OK
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
        try
        {
            RagQueryResponse response =
                await _ragApiClient.QueryAsync(
                    request,
                    cancellationToken
                );

            return Ok(response);
        }
        catch (TaskCanceledException exception)
            when (!HttpContext.RequestAborted.IsCancellationRequested)
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
        catch (
            Exception exception
        ) when (
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
}