using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using RagMiddleware.Infrastructure.Configuration;

namespace RagMiddleware.Infrastructure.Persistence;

public sealed class MongoDbContext
{
    private readonly MongoClient _client;

    public MongoDbContext(
        IOptions<MongoDbOptions> options
    )
    {
        MongoDbOptions configuration = options.Value;

        MongoClientSettings settings =
            MongoClientSettings.FromConnectionString(
                configuration.ConnectionString
            );

        // Avoid waiting a long time when MongoDB is unavailable.
        settings.ServerSelectionTimeout =
            TimeSpan.FromSeconds(5);

        _client = new MongoClient(settings);

        Database = _client.GetDatabase(
            configuration.DatabaseName
        );
    }

    public IMongoDatabase Database { get; }

    public string DatabaseName =>
        Database.DatabaseNamespace.DatabaseName;

    public async Task PingAsync(
        CancellationToken cancellationToken = default
    )
    {
        var command =
            new BsonDocumentCommand<BsonDocument>(
                new BsonDocument("ping", 1)
            );

        await Database.RunCommandAsync(
            command,
            cancellationToken: cancellationToken
        );
    }
}