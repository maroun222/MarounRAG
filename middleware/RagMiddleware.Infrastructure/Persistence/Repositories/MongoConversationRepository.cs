using MongoDB.Driver;
using RagMiddleware.Application.Abstractions.Persistence;
using RagMiddleware.Domain.Entities;
using RagMiddleware.Infrastructure.Persistence.Documents;

namespace RagMiddleware.Infrastructure.Persistence.Repositories;

public sealed class MongoConversationRepository
    : IConversationRepository
{
    private const string ConversationsCollectionName =
        "conversations";

    private const string MessagesCollectionName =
        "messages";

    private readonly IMongoCollection<ConversationDocument>
        _conversations;

    private readonly IMongoCollection<ConversationMessageDocument>
        _messages;

    public MongoConversationRepository(
        MongoDbContext mongoDbContext
    )
    {
        _conversations =
            mongoDbContext.Database
                .GetCollection<ConversationDocument>(
                    ConversationsCollectionName
                );

        _messages =
            mongoDbContext.Database
                .GetCollection<ConversationMessageDocument>(
                    MessagesCollectionName
                );
    }

    public async Task EnsureIndexesAsync(
        CancellationToken cancellationToken = default
    )
    {
        var conversationIndexKeys =
            Builders<ConversationDocument>
                .IndexKeys
                .Ascending(document => document.UserId)
                .Descending(document => document.UpdatedAtUtc);

        var conversationIndex =
            new CreateIndexModel<ConversationDocument>(
                conversationIndexKeys,
                new CreateIndexOptions
                {
                    Name = "ix_conversations_user_updated"
                }
            );

        await _conversations.Indexes.CreateOneAsync(
            conversationIndex,
            cancellationToken: cancellationToken
        );

        var messageIndexKeys =
            Builders<ConversationMessageDocument>
                .IndexKeys
                .Ascending(document => document.UserId)
                .Ascending(document => document.ConversationId)
                .Ascending(document => document.CreatedAtUtc);

        var messageIndex =
            new CreateIndexModel<ConversationMessageDocument>(
                messageIndexKeys,
                new CreateIndexOptions
                {
                    Name = "ix_messages_user_conversation_created"
                }
            );

        await _messages.Indexes.CreateOneAsync(
            messageIndex,
            cancellationToken: cancellationToken
        );
    }

    public async Task CreateConversationAsync(
        Conversation conversation,
        CancellationToken cancellationToken = default
    )
    {
        ConversationDocument document =
            ToConversationDocument(conversation);

        await _conversations.InsertOneAsync(
            document,
            cancellationToken: cancellationToken
        );
    }

    public async Task<IReadOnlyList<Conversation>>
        ListConversationsAsync(
            string userId,
            CancellationToken cancellationToken = default
        )
    {
        FilterDefinition<ConversationDocument> filter =
            Builders<ConversationDocument>
                .Filter
                .Eq(document => document.UserId, userId);

        List<ConversationDocument> documents =
            await _conversations
                .Find(filter)
                .SortByDescending(
                    document => document.UpdatedAtUtc
                )
                .ToListAsync(cancellationToken);

        return documents
            .Select(ToConversation)
            .ToArray();
    }

    public async Task<Conversation?> GetConversationAsync(
        string conversationId,
        string userId,
        CancellationToken cancellationToken = default
    )
    {
        FilterDefinition<ConversationDocument> filter =
            Builders<ConversationDocument>
                .Filter
                .And(
                    Builders<ConversationDocument>
                        .Filter
                        .Eq(
                            document => document.Id,
                            conversationId
                        ),
                    Builders<ConversationDocument>
                        .Filter
                        .Eq(
                            document => document.UserId,
                            userId
                        )
                );

        ConversationDocument? document =
            await _conversations
                .Find(filter)
                .FirstOrDefaultAsync(cancellationToken);

        return document is null
            ? null
            : ToConversation(document);
    }

    public async Task AddMessageAsync(
        ConversationMessage message,
        CancellationToken cancellationToken = default
    )
    {
        ConversationMessageDocument document =
            ToMessageDocument(message);

        await _messages.InsertOneAsync(
            document,
            cancellationToken: cancellationToken
        );
    }

    public async Task<IReadOnlyList<ConversationMessage>>
        ListMessagesAsync(
            string conversationId,
            string userId,
            CancellationToken cancellationToken = default
        )
    {
        FilterDefinition<ConversationMessageDocument> filter =
            Builders<ConversationMessageDocument>
                .Filter
                .And(
                    Builders<ConversationMessageDocument>
                        .Filter
                        .Eq(
                            document =>
                                document.ConversationId,
                            conversationId
                        ),
                    Builders<ConversationMessageDocument>
                        .Filter
                        .Eq(
                            document => document.UserId,
                            userId
                        )
                );

        List<ConversationMessageDocument> documents =
            await _messages
                .Find(filter)
                .SortBy(
                    document => document.CreatedAtUtc
                )
                .ToListAsync(cancellationToken);

        return documents
            .Select(ToMessage)
            .ToArray();
    }

    public async Task UpdateConversationTimestampAsync(
        string conversationId,
        string userId,
        DateTime updatedAtUtc,
        CancellationToken cancellationToken = default
    )
    {
        FilterDefinition<ConversationDocument> filter =
            Builders<ConversationDocument>
                .Filter
                .And(
                    Builders<ConversationDocument>
                        .Filter
                        .Eq(
                            document => document.Id,
                            conversationId
                        ),
                    Builders<ConversationDocument>
                        .Filter
                        .Eq(
                            document => document.UserId,
                            userId
                        )
                );

        UpdateDefinition<ConversationDocument> update =
            Builders<ConversationDocument>
                .Update
                .Set(
                    document => document.UpdatedAtUtc,
                    updatedAtUtc
                );

        await _conversations.UpdateOneAsync(
            filter,
            update,
            cancellationToken: cancellationToken
        );
    }

    private static ConversationDocument
        ToConversationDocument(
            Conversation conversation
        )
    {
        return new ConversationDocument
        {
            Id = conversation.Id,
            UserId = conversation.UserId,
            Title = conversation.Title,
            CreatedAtUtc = conversation.CreatedAtUtc,
            UpdatedAtUtc = conversation.UpdatedAtUtc
        };
    }

    private static Conversation ToConversation(
        ConversationDocument document
    )
    {
        return new Conversation
        {
            Id = document.Id,
            UserId = document.UserId,
            Title = document.Title,
            CreatedAtUtc = document.CreatedAtUtc,
            UpdatedAtUtc = document.UpdatedAtUtc
        };
    }

    private static ConversationMessageDocument
    ToMessageDocument(
        ConversationMessage message
    )
{
    return new ConversationMessageDocument
    {
        Id = message.Id,
        ConversationId = message.ConversationId,
        UserId = message.UserId,
        Role = message.Role,
        Content = message.Content,
        Page = message.Page,
        Context = message.Context,

        RetrievalContext =
            message.RetrievalContext.ToList(),

        Sources = message.Sources
            .Select(
                source =>
                    new ConversationSourceDocument
                    {
                        CitationId =
                            source.CitationId,
                        Document =
                            source.Document,
                        Page =
                            source.Page,
                        Snippet =
                            source.Snippet
                    }
            )
            .ToList(),

        CacheHit = message.CacheHit,

        Timings =
            new Dictionary<string, double>(
                message.Timings
            ),

        CreatedAtUtc = message.CreatedAtUtc
    };
}

    private static ConversationMessage ToMessage(
    ConversationMessageDocument document
)
{
    return new ConversationMessage
    {
        Id = document.Id,
        ConversationId = document.ConversationId,
        UserId = document.UserId,
        Role = document.Role,
        Content = document.Content,
        Page = document.Page,
        Context = document.Context,

        RetrievalContext =
            document.RetrievalContext.ToArray(),

        Sources = document.Sources
            .Select(
                source =>
                    new ConversationSource
                    {
                        CitationId =
                            source.CitationId,
                        Document =
                            source.Document,
                        Page =
                            source.Page,
                        Snippet =
                            source.Snippet
                    }
            )
            .ToArray(),

        CacheHit = document.CacheHit,

        Timings =
            new Dictionary<string, double>(
                document.Timings
            ),

        CreatedAtUtc = document.CreatedAtUtc
    };
}
}