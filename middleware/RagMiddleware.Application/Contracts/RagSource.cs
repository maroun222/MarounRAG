using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts;

public sealed class RagSource
{
    [JsonPropertyName("citation_id")]
    public int CitationId { get; init; }

    [JsonPropertyName("document")]
    public string Document { get; init; } =
        string.Empty;

    [JsonPropertyName("page")]
    public int? Page { get; init; }

    [JsonPropertyName("snippet")]
    public string Snippet { get; init; } =
        string.Empty;
}