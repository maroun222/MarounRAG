namespace RagMiddleware.Domain.Entities;

public sealed class Conversation
{
    public string Id { get; init; } = string.Empty;

    public string UserId { get; init; } = string.Empty;

    public string Title { get; init; } = "New conversation";

    public DateTime CreatedAtUtc { get; init; }

    public DateTime UpdatedAtUtc { get; init; }
}