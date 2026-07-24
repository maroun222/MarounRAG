using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RagMiddleware.Infrastructure.Persistence.Repositories;

namespace RagMiddleware.Infrastructure.Persistence;

public sealed class MongoDbIndexInitializer
    : IHostedService
{
    private readonly MongoConversationRepository
        _conversationRepository;

    private readonly ILogger<MongoDbIndexInitializer>
        _logger;

    public MongoDbIndexInitializer(
        MongoConversationRepository conversationRepository,
        ILogger<MongoDbIndexInitializer> logger
    )
    {
        _conversationRepository = conversationRepository;
        _logger = logger;
    }

    public async Task StartAsync(
        CancellationToken cancellationToken
    )
    {
        _logger.LogInformation(
            "Creating MongoDB indexes."
        );

        await _conversationRepository
            .EnsureIndexesAsync(cancellationToken);

        _logger.LogInformation(
            "MongoDB indexes are ready."
        );
    }

    public Task StopAsync(
        CancellationToken cancellationToken
    )
    {
        return Task.CompletedTask;
    }
}