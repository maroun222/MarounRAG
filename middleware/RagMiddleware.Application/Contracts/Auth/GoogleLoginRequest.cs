using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts.Auth;

public sealed class GoogleLoginRequest
{
    [Required]
    [JsonPropertyName("credential")]
    public string Credential { get; init; } =
        string.Empty;
}