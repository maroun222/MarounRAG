using System.ComponentModel.DataAnnotations;

namespace RagMiddleware.Infrastructure.Configuration;

public sealed class JwtOptions
{
    public const string SectionName =
        "Jwt";

    [Required]
    public string SigningKey { get; init; } =
        string.Empty;

    [Required]
    public string Issuer { get; init; } =
        string.Empty;

    [Required]
    public string Audience { get; init; } =
        string.Empty;

    [Range(5, 1440)]
    public int LifetimeMinutes { get; init; } =
        120;
}
