namespace RagMiddleware.Application.Contracts.Auth;

public sealed class JwtTokenResult
{
    public string Token { get; init; } =
        string.Empty;

    public DateTime ExpiresAtUtc { get; init; }
}