using Microsoft.AspNetCore.Mvc;
using RagMiddleware.Infrastructure.Persistence;

namespace RagMiddleware.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    private readonly MongoDbContext _mongoDbContext;
    private readonly ILogger<HealthController> _logger;

    public HealthController(
        MongoDbContext mongoDbContext,
        ILogger<HealthController> logger
    )
    {
        _mongoDbContext = mongoDbContext;
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(
        StatusCodes.Status503ServiceUnavailable
    )]
    public async Task<IActionResult> GetHealth(
        CancellationToken cancellationToken
    )
    {
        try
        {
            await _mongoDbContext.PingAsync(
                cancellationToken
            );

            return Ok(new
            {
                status = "ok",
                service = "RAG Middleware API",
                components = new
                {
                    mongodb = "connected"
                },
                database = new
                {
                    name = _mongoDbContext.DatabaseName
                },
                timestampUtc = DateTimeOffset.UtcNow
            });
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "MongoDB health check failed."
            );

            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new
                {
                    status = "unavailable",
                    service = "RAG Middleware API",
                    components = new
                    {
                        mongodb = "disconnected"
                    },
                    timestampUtc = DateTimeOffset.UtcNow
                }
            );
        }
    }
}