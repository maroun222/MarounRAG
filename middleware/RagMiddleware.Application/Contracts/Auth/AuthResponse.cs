using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts.Auth;

public sealed class AuthResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; init; } =
        string.Empty;

    [JsonPropertyName("token_type")]
    public string TokenType { get; init; } =
        "Bearer";

    [JsonPropertyName("expires_at_utc")]
    public DateTime ExpiresAtUtc { get; init; }

    [JsonPropertyName("user")]
    public AuthUserResponse User { get; init; } =
        new();
}