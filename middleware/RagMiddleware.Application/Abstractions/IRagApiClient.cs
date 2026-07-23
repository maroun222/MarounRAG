using RagMiddleware.Application.Contracts;

namespace RagMiddleware.Application.Abstractions;

public interface IRagApiClient
{
    Task<RagQueryResponse> QueryAsync(
        RagQueryRequest request,
        CancellationToken cancellationToken = default
    );
}