using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts;

public sealed class RagQueryResponse
{
    [JsonPropertyName("answer")]
    public string Answer { get; init; } =
        string.Empty;

    [JsonPropertyName("page")]
    public int? Page { get; init; }

    [JsonPropertyName("context")]
    public string Context { get; init; } =
        string.Empty;

    [JsonPropertyName("retrieval_context")]
    public IReadOnlyList<string> RetrievalContext
    {
        get;
        init;
    } = Array.Empty<string>();

    [JsonPropertyName("sources")]
    public IReadOnlyList<RagSource> Sources
    {
        get;
        init;
    } = Array.Empty<RagSource>();

    [JsonPropertyName("cache_hit")]
    public bool CacheHit { get; init; }

    [JsonPropertyName("timings")]
    public IReadOnlyDictionary<string, double> Timings
    {
        get;
        init;
    } = new Dictionary<string, double>();
}