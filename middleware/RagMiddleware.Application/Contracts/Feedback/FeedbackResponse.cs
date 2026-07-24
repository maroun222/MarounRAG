using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts.Feedback;

public sealed class FeedbackResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } =
        string.Empty;

    [JsonPropertyName("conversation_id")]
    public string ConversationId { get; init; } =
        string.Empty;

    [JsonPropertyName("message_id")]
    public string MessageId { get; init; } =
        string.Empty;

    [JsonPropertyName("rating")]
    public string Rating { get; init; } =
        string.Empty;

    [JsonPropertyName("comment")]
    public string? Comment { get; init; }

    [JsonPropertyName("created_at_utc")]
    public DateTime CreatedAtUtc { get; init; }

    [JsonPropertyName("updated_at_utc")]
    public DateTime UpdatedAtUtc { get; init; }
}