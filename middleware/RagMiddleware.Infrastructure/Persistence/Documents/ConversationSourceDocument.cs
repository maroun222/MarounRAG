using MongoDB.Bson.Serialization.Attributes;

namespace RagMiddleware.Infrastructure.Persistence.Documents;

public sealed class ConversationSourceDocument
{
    [BsonElement("citation_id")]
    public int CitationId { get; set; }

    [BsonElement("document")]
    public string Document { get; set; } =
        string.Empty;

    [BsonElement("page")]
    [BsonIgnoreIfNull]
    public int? Page { get; set; }

    [BsonElement("snippet")]
    public string Snippet { get; set; } =
        string.Empty;
}
