using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts;

public sealed class RagQueryRequest
{
    [Required]
    [StringLength(
        2000,
        MinimumLength = 1
    )]
    [JsonPropertyName("message")]
    public string Message { get; init; } = string.Empty;
}