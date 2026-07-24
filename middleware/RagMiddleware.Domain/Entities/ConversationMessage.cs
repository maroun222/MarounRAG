namespace RagMiddleware.Domain.Entities;

public sealed class ConversationMessage
{
    public string Id { get; init; } = string.Empty;

    public string ConversationId { get; init; } =
        string.Empty;

    public string UserId { get; init; } = string.Empty;

    public string Role { get; init; } = string.Empty;

    public string Content { get; init; } = string.Empty;

    public int? Page { get; init; }

    public string? Context { get; init; }

    public IReadOnlyList<string> RetrievalContext { get; init; } =
        Array.Empty<string>();

    public bool? CacheHit { get; init; }

    public IReadOnlyDictionary<string, double> Timings { get; init; } =
        new Dictionary<string, double>();

    public DateTime CreatedAtUtc { get; init; }
}