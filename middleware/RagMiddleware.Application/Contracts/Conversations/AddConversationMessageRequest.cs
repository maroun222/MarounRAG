using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts.Conversations;

public sealed class AddConversationMessageRequest
{
    [Required]
    [RegularExpression(
        "^(user|assistant)$",
        ErrorMessage = "Role must be user or assistant."
    )]
    [JsonPropertyName("role")]
    public string Role { get; init; } = string.Empty;

    [Required]
    [StringLength(20000, MinimumLength = 1)]
    [JsonPropertyName("content")]
    public string Content { get; init; } = string.Empty;

    [JsonPropertyName("page")]
    public int? Page { get; init; }

    [JsonPropertyName("context")]
    public string? Context { get; init; }

    [JsonPropertyName("retrieval_context")]
    public IReadOnlyList<string> RetrievalContext { get; init; } =
        Array.Empty<string>();

    [JsonPropertyName("cache_hit")]
    public bool? CacheHit { get; init; }

    [JsonPropertyName("timings")]
    public IReadOnlyDictionary<string, double> Timings { get; init; } =
        new Dictionary<string, double>();
}