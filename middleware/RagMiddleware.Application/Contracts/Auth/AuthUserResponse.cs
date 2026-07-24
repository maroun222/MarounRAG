using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts.Auth;

public sealed class AuthUserResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } =
        string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; init; } =
        string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; init; } =
        string.Empty;

    [JsonPropertyName("picture_url")]
    public string? PictureUrl { get; init; }
}