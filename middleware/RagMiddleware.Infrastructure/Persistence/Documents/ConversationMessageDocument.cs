using MongoDB.Bson.Serialization.Attributes;

namespace RagMiddleware.Infrastructure.Persistence.Documents;

public sealed class ConversationMessageDocument
{
    [BsonId]
    public string Id { get; set; } = string.Empty;

    [BsonElement("conversation_id")]
    public string ConversationId { get; set; } =
        string.Empty;

    [BsonElement("user_id")]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("role")]
    public string Role { get; set; } = string.Empty;

    [BsonElement("content")]
    public string Content { get; set; } = string.Empty;

    [BsonElement("page")]
    [BsonIgnoreIfNull]
    public int? Page { get; set; }

    [BsonElement("context")]
    [BsonIgnoreIfNull]
    public string? Context { get; set; }

    [BsonElement("retrieval_context")]
    public List<string> RetrievalContext { get; set; } = [];

    [BsonElement("cache_hit")]
    [BsonIgnoreIfNull]
    public bool? CacheHit { get; set; }

    [BsonElement("timings")]
    public Dictionary<string, double> Timings { get; set; } =
        [];

    [BsonElement("created_at_utc")]
    public DateTime CreatedAtUtc { get; set; }
}