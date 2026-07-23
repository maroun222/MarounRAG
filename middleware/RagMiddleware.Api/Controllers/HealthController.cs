using Microsoft.AspNetCore.Mvc;

namespace RagMiddleware.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetHealth()
    {
        return Ok(new
        {
            status = "ok",
            service = "RAG Middleware API",
            timestampUtc = DateTimeOffset.UtcNow
        });
    }
}