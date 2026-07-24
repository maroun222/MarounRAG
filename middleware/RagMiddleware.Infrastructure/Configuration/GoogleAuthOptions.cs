using System.ComponentModel.DataAnnotations;

namespace RagMiddleware.Infrastructure.Configuration;

public sealed class GoogleAuthOptions
{
    public const string SectionName =
        "GoogleAuth";

    [Required]
    public string ClientId { get; init; } =
        string.Empty;
}