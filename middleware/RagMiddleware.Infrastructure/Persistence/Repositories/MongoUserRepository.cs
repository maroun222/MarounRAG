using MongoDB.Driver;

using RagMiddleware.Application.Abstractions.Persistence;
using RagMiddleware.Domain.Entities;
using RagMiddleware.Infrastructure.Persistence.Documents;

namespace RagMiddleware.Infrastructure.Persistence.Repositories;

public sealed class MongoUserRepository
    : IUserRepository
{
    private const string CollectionName =
        "users";

    private readonly IMongoCollection<UserDocument>
        _users;

    public MongoUserRepository(
        MongoDbContext mongoDbContext
    )
    {
        _users =
            mongoDbContext.Database
                .GetCollection<UserDocument>(
                    CollectionName
                );
    }

    public async Task EnsureIndexesAsync(
        CancellationToken cancellationToken = default
    )
    {
        var googleSubjectIndex =
            new CreateIndexModel<UserDocument>(
                Builders<UserDocument>
                    .IndexKeys
                    .Ascending(
                        document =>
                            document.GoogleSubject
                    ),
                new CreateIndexOptions
                {
                    Name =
                        "ux_users_google_subject",
                    Unique = true
                }
            );

        await _users.Indexes.CreateOneAsync(
            googleSubjectIndex,
            cancellationToken:
                cancellationToken
        );
    }

    public async Task<ApplicationUser>
        UpsertGoogleUserAsync(
            ApplicationUser user,
            CancellationToken cancellationToken = default
        )
    {
        FilterDefinition<UserDocument> filter =
            Builders<UserDocument>
                .Filter
                .Eq(
                    document =>
                        document.GoogleSubject,
                    user.GoogleSubject
                );

        UpdateDefinition<UserDocument> update =
            Builders<UserDocument>
                .Update
                .Set(
                    document => document.Email,
                    user.Email
                )
                .Set(
                    document => document.Name,
                    user.Name
                )
                .Set(
                    document =>
                        document.PictureUrl,
                    user.PictureUrl
                )
                .Set(
                    document =>
                        document.EmailVerified,
                    user.EmailVerified
                )
                .Set(
                    document =>
                        document.UpdatedAtUtc,
                    user.UpdatedAtUtc
                )
                .Set(
                    document =>
                        document.LastLoginAtUtc,
                    user.LastLoginAtUtc
                )
                .SetOnInsert(
                    document => document.Id,
                    user.Id
                )
                .SetOnInsert(
                    document =>
                        document.GoogleSubject,
                    user.GoogleSubject
                )
                .SetOnInsert(
                    document =>
                        document.CreatedAtUtc,
                    user.CreatedAtUtc
                );

        UserDocument document =
            await _users.FindOneAndUpdateAsync(
                filter,
                update,
                new FindOneAndUpdateOptions<
                    UserDocument
                >
                {
                    IsUpsert = true,
                    ReturnDocument =
                        ReturnDocument.After
                },
                cancellationToken
            );

        return ToDomain(document);
    }

    private static ApplicationUser ToDomain(
        UserDocument document
    )
    {
        return new ApplicationUser
        {
            Id = document.Id,
            GoogleSubject =
                document.GoogleSubject,
            Email = document.Email,
            Name = document.Name,
            PictureUrl =
                document.PictureUrl,
            EmailVerified =
                document.EmailVerified,
            CreatedAtUtc =
                document.CreatedAtUtc,
            UpdatedAtUtc =
                document.UpdatedAtUtc,
            LastLoginAtUtc =
                document.LastLoginAtUtc
        };
    }
}