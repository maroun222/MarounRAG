using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts;

public sealed class RagQueryRequest
{
    [JsonPropertyName("conversation_id")]
    public string? ConversationId { get; init; }

    [Required]
    [StringLength(
        2000,
        MinimumLength = 1
    )]
    [JsonPropertyName("message")]
    public string Message { get; init; } =
        string.Empty;

    [JsonPropertyName("use_cache")]
    public bool UseCache { get; init; } =
        true;
}