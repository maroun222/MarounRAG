namespace RagMiddleware.Domain.Entities;

public sealed class ConversationSource
{
    public int CitationId { get; init; }

    public string Document { get; init; } =
        string.Empty;

    public int? Page { get; init; }

    public string Snippet { get; init; } =
        string.Empty;
}