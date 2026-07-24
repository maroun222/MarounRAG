using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

using RagMiddleware.Infrastructure.Persistence.Repositories;

namespace RagMiddleware.Infrastructure.Persistence;

public sealed class MongoUserIndexInitializer
    : IHostedService
{
    private readonly MongoUserRepository
        _repository;

    private readonly ILogger<
        MongoUserIndexInitializer
    > _logger;

    public MongoUserIndexInitializer(
        MongoUserRepository repository,
        ILogger<MongoUserIndexInitializer> logger
    )
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task StartAsync(
        CancellationToken cancellationToken
    )
    {
        _logger.LogInformation(
            "Creating MongoDB user indexes."
        );

        await _repository.EnsureIndexesAsync(
            cancellationToken
        );

        _logger.LogInformation(
            "MongoDB user indexes are ready."
        );
    }

    public Task StopAsync(
        CancellationToken cancellationToken
    )
    {
        return Task.CompletedTask;
    }
}