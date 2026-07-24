using RagMiddleware.Domain.Entities;

namespace RagMiddleware.Application.Abstractions.Persistence;

public interface IConversationRepository
{
    Task CreateConversationAsync(
        Conversation conversation,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<Conversation>> ListConversationsAsync(
        string userId,
        CancellationToken cancellationToken = default
    );

    Task<Conversation?> GetConversationAsync(
        string conversationId,
        string userId,
        CancellationToken cancellationToken = default
    );

    Task AddMessageAsync(
        ConversationMessage message,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<ConversationMessage>> ListMessagesAsync(
        string conversationId,
        string userId,
        CancellationToken cancellationToken = default
    );

    Task UpdateConversationTimestampAsync(
        string conversationId,
        string userId,
        DateTime updatedAtUtc,
        CancellationToken cancellationToken = default
    );
}