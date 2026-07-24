namespace RagMiddleware.Domain.Entities;

public sealed class ApplicationUser
{
    public string Id { get; init; } =
        string.Empty;

    public string GoogleSubject { get; init; } =
        string.Empty;

    public string Email { get; init; } =
        string.Empty;

    public string Name { get; init; } =
        string.Empty;

    public string? PictureUrl { get; init; }

    public bool EmailVerified { get; init; }

    public DateTime CreatedAtUtc { get; init; }

    public DateTime UpdatedAtUtc { get; init; }

    public DateTime LastLoginAtUtc { get; init; }
}