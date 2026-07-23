using System.Net.Http.Json;
using RagMiddleware.Application.Abstractions;
using RagMiddleware.Application.Contracts;

namespace RagMiddleware.Infrastructure.Clients;

public sealed class RagApiClient : IRagApiClient
{
    private readonly HttpClient _httpClient;

    public RagApiClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<RagQueryResponse> QueryAsync(
        RagQueryRequest request,
        CancellationToken cancellationToken = default
    )
    {
        using HttpResponseMessage response =
            await _httpClient.PostAsJsonAsync(
                "chat",
                request,
                cancellationToken
            );

        response.EnsureSuccessStatusCode();

        RagQueryResponse? result =
            await response.Content.ReadFromJsonAsync<RagQueryResponse>(
                cancellationToken: cancellationToken
            );

        return result
            ?? throw new InvalidOperationException(
                "The Python RAG API returned an empty response."
            );
    }
}