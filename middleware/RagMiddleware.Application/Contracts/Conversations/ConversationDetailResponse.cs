using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts.Conversations;

public sealed class ConversationDetailResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("created_at_utc")]
    public DateTime CreatedAtUtc { get; init; }

    [JsonPropertyName("updated_at_utc")]
    public DateTime UpdatedAtUtc { get; init; }

    [JsonPropertyName("messages")]
    public IReadOnlyList<ConversationMessageResponse> Messages {
        get;
        init;
    } = Array.Empty<ConversationMessageResponse>();
}