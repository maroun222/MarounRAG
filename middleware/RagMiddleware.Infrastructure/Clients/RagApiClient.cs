using System.Net.Http.Headers;
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

    public async Task<HttpResponseMessage> StreamQueryAsync(
        RagQueryRequest request,
        CancellationToken cancellationToken = default
    )
    {
        using var httpRequest = new HttpRequestMessage(
            HttpMethod.Post,
            "chat/stream"
        )
        {
            Content = JsonContent.Create(request)
        };

        httpRequest.Headers.Accept.Add(
            new MediaTypeWithQualityHeaderValue(
                "text/event-stream"
            )
        );

        return await _httpClient.SendAsync(
            httpRequest,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken
        );
    }
}