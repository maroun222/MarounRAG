using MongoDB.Bson.Serialization.Attributes;

namespace RagMiddleware.Infrastructure.Persistence.Documents;

public sealed class ConversationDocument
{
    [BsonId]
    public string Id { get; set; } = string.Empty;

    [BsonElement("user_id")]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("created_at_utc")]
    public DateTime CreatedAtUtc { get; set; }

    [BsonElement("updated_at_utc")]
    public DateTime UpdatedAtUtc { get; set; }
}