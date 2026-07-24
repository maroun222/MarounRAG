using MongoDB.Bson.Serialization.Attributes;

namespace RagMiddleware.Infrastructure.Persistence.Documents;

public sealed class FeedbackDocument
{
    [BsonId]
    public string Id { get; set; } =
        string.Empty;

    [BsonElement("user_id")]
    public string UserId { get; set; } =
        string.Empty;

    [BsonElement("conversation_id")]
    public string ConversationId { get; set; } =
        string.Empty;

    [BsonElement("message_id")]
    public string MessageId { get; set; } =
        string.Empty;

    [BsonElement("rating")]
    public string Rating { get; set; } =
        string.Empty;

    [BsonElement("comment")]
    [BsonIgnoreIfNull]
    public string? Comment { get; set; }

    [BsonElement("created_at_utc")]
    public DateTime CreatedAtUtc { get; set; }

    [BsonElement("updated_at_utc")]
    public DateTime UpdatedAtUtc { get; set; }
}