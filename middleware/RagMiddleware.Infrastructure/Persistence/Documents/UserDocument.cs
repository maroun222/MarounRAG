using MongoDB.Bson.Serialization.Attributes;

namespace RagMiddleware.Infrastructure.Persistence.Documents;

public sealed class UserDocument
{
    [BsonId]
    [BsonElement("_id")]
    public string Id { get; set; } =
        string.Empty;

    [BsonElement("google_subject")]
    public string GoogleSubject { get; set; } =
        string.Empty;

    [BsonElement("email")]
    public string Email { get; set; } =
        string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } =
        string.Empty;

    [BsonElement("picture_url")]
    [BsonIgnoreIfNull]
    public string? PictureUrl { get; set; }

    [BsonElement("email_verified")]
    public bool EmailVerified { get; set; }

    [BsonElement("created_at_utc")]
    public DateTime CreatedAtUtc { get; set; }

    [BsonElement("updated_at_utc")]
    public DateTime UpdatedAtUtc { get; set; }

    [BsonElement("last_login_at_utc")]
    public DateTime LastLoginAtUtc { get; set; }
}