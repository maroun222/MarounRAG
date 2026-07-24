using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts.Conversations;

public sealed class ConversationMessageResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("conversation_id")]
    public string ConversationId { get; init; } = string.Empty;

    [JsonPropertyName("role")]
    public string Role { get; init; } = string.Empty;

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

    [JsonPropertyName("created_at_utc")]
    public DateTime CreatedAtUtc { get; init; }
}