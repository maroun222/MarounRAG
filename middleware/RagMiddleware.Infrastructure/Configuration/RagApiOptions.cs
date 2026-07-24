using System.ComponentModel.DataAnnotations;

namespace RagMiddleware.Infrastructure.Configuration;

public sealed class RagApiOptions
{
    public const string SectionName = "RagApi";

    [Required]
    [Url]
    public string BaseUrl { get; init; } = string.Empty;

    public string? ApiKey { get; init; }
}