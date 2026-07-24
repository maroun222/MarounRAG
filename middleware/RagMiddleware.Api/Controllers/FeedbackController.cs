using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using RagMiddleware.Application.Abstractions.Persistence;
using RagMiddleware.Application.Contracts.Feedback;
using RagMiddleware.Domain.Entities;
using RagMiddleware.Infrastructure.Persistence;
using RagMiddleware.Infrastructure.Persistence.Documents;

namespace RagMiddleware.Api.Controllers;

[ApiController]
[Route("api/feedback")]
public sealed class FeedbackController : ControllerBase
{
    private const string UserIdHeaderName =
        "X-User-Id";

    private const string MessagesCollectionName =
        "messages";

    private const string FeedbackCollectionName =
        "feedback";

    private readonly IConversationRepository
        _conversationRepository;

    private readonly IMongoCollection<
        ConversationMessageDocument
    > _messages;

    private readonly IMongoCollection<
        FeedbackDocument
    > _feedback;


    public FeedbackController(
        IConversationRepository conversationRepository,
        MongoDbContext mongoDbContext
    )
    {
        _conversationRepository =
            conversationRepository;

        _messages =
            mongoDbContext.Database.GetCollection<
                ConversationMessageDocument
            >(MessagesCollectionName);

        _feedback =
            mongoDbContext.Database.GetCollection<
                FeedbackDocument
            >(FeedbackCollectionName);
    }


    // ========================================================
    // Submit or update feedback
    // ========================================================

    [HttpPut]
    [ProducesResponseType(
        typeof(FeedbackResponse),
        StatusCodes.Status200OK
    )]
    [ProducesResponseType(
        StatusCodes.Status400BadRequest
    )]
    [ProducesResponseType(
        StatusCodes.Status401Unauthorized
    )]
    [ProducesResponseType(
        StatusCodes.Status404NotFound
    )]
    public async Task<
        ActionResult<FeedbackResponse>
    > SubmitFeedback(
        [FromBody] SubmitFeedbackRequest request,
        CancellationToken cancellationToken
    )
    {
        string? userId =
            GetCurrentUserId();

        if (userId is null)
        {
            return MissingUserResponse();
        }

        string conversationId =
            request.ConversationId.Trim();

        string messageId =
            request.MessageId.Trim();

        string rating =
            request.Rating
                .Trim()
                .ToLowerInvariant();

        string? comment =
            string.IsNullOrWhiteSpace(
                request.Comment
            )
                ? null
                : request.Comment.Trim();


        if (
            string.IsNullOrWhiteSpace(
                conversationId
            ) ||
            string.IsNullOrWhiteSpace(
                messageId
            )
        )
        {
            return BadRequest(
                new
                {
                    error =
                        "Conversation ID and message ID are required."
                }
            );
        }

        if (
            rating != "up" &&
            rating != "down"
        )
        {
            return BadRequest(
                new
                {
                    error =
                        "Rating must be either 'up' or 'down'."
                }
            );
        }


        /*
         * Verify that the conversation belongs to the
         * current user.
         */
        Conversation? conversation =
            await _conversationRepository
                .GetConversationAsync(
                    conversationId,
                    userId,
                    cancellationToken
                );

        if (conversation is null)
        {
            return NotFound(
                new
                {
                    error =
                        "Conversation not found."
                }
            );
        }


        /*
         * Feedback may only be submitted for an assistant
         * message that belongs to the same user and
         * conversation.
         */
        FilterDefinition<
            ConversationMessageDocument
        > messageFilter =
            Builders<
                ConversationMessageDocument
            >.Filter.And(
                Builders<
                    ConversationMessageDocument
                >.Filter.Eq(
                    document =>
                        document.Id,
                    messageId
                ),

                Builders<
                    ConversationMessageDocument
                >.Filter.Eq(
                    document =>
                        document.ConversationId,
                    conversationId
                ),

                Builders<
                    ConversationMessageDocument
                >.Filter.Eq(
                    document =>
                        document.UserId,
                    userId
                ),

                Builders<
                    ConversationMessageDocument
                >.Filter.Eq(
                    document =>
                        document.Role,
                    "assistant"
                )
            );

        bool messageExists =
            await _messages
                .Find(messageFilter)
                .AnyAsync(
                    cancellationToken
                );

        if (!messageExists)
        {
            return NotFound(
                new
                {
                    error =
                        "Assistant message not found."
                }
            );
        }


        /*
         * One feedback record is kept for each user and
         * assistant message. Pressing the opposite button
         * updates the existing record.
         */
        string feedbackId =
            $"{userId}:{messageId}";

        FilterDefinition<
            FeedbackDocument
        > feedbackFilter =
            Builders<
                FeedbackDocument
            >.Filter.Eq(
                document =>
                    document.Id,
                feedbackId
            );

        FeedbackDocument? existingFeedback =
            await _feedback
                .Find(feedbackFilter)
                .FirstOrDefaultAsync(
                    cancellationToken
                );

        DateTime now =
            DateTime.UtcNow;

        var feedbackDocument =
            new FeedbackDocument
            {
                Id =
                    feedbackId,

                UserId =
                    userId,

                ConversationId =
                    conversationId,

                MessageId =
                    messageId,

                Rating =
                    rating,

                Comment =
                    comment,

                CreatedAtUtc =
                    existingFeedback
                        ?.CreatedAtUtc ??
                    now,

                UpdatedAtUtc =
                    now
            };

        await _feedback.ReplaceOneAsync(
            feedbackFilter,
            feedbackDocument,
            new ReplaceOptions
            {
                IsUpsert = true
            },
            cancellationToken
        );

        return Ok(
            ToResponse(
                feedbackDocument
            )
        );
    }


    // ========================================================
    // Get feedback for one conversation
    // ========================================================

    [HttpGet(
        "conversations/{conversationId}"
    )]
    [ProducesResponseType(
        typeof(
            IReadOnlyList<
                FeedbackResponse
            >
        ),
        StatusCodes.Status200OK
    )]
    [ProducesResponseType(
        StatusCodes.Status401Unauthorized
    )]
    [ProducesResponseType(
        StatusCodes.Status404NotFound
    )]
    public async Task<
        ActionResult<
            IReadOnlyList<
                FeedbackResponse
            >
        >
    > ListConversationFeedback(
        string conversationId,
        CancellationToken cancellationToken
    )
    {
        string? userId =
            GetCurrentUserId();

        if (userId is null)
        {
            return MissingUserResponse();
        }

        string normalizedConversationId =
            conversationId.Trim();

        Conversation? conversation =
            await _conversationRepository
                .GetConversationAsync(
                    normalizedConversationId,
                    userId,
                    cancellationToken
                );

        if (conversation is null)
        {
            return NotFound(
                new
                {
                    error =
                        "Conversation not found."
                }
            );
        }

        FilterDefinition<
            FeedbackDocument
        > filter =
            Builders<
                FeedbackDocument
            >.Filter.And(
                Builders<
                    FeedbackDocument
                >.Filter.Eq(
                    document =>
                        document.UserId,
                    userId
                ),

                Builders<
                    FeedbackDocument
                >.Filter.Eq(
                    document =>
                        document.ConversationId,
                    normalizedConversationId
                )
            );

        List<FeedbackDocument> documents =
            await _feedback
                .Find(filter)
                .SortBy(
                    document =>
                        document.CreatedAtUtc
                )
                .ToListAsync(
                    cancellationToken
                );

        FeedbackResponse[] response =
            documents
                .Select(ToResponse)
                .ToArray();

        return Ok(response);
    }


    // ========================================================
    // Helpers
    // ========================================================

    private string? GetCurrentUserId()
    {
        string value =
            Request.Headers[
                UserIdHeaderName
            ]
            .FirstOrDefault()
            ?.Trim() ??
            string.Empty;

        return string.IsNullOrWhiteSpace(
            value
        )
            ? null
            : value;
    }


    private ActionResult MissingUserResponse()
    {
        return Unauthorized(
            new
            {
                error =
                    $"The {UserIdHeaderName} header is required during development."
            }
        );
    }


    private static FeedbackResponse ToResponse(
        FeedbackDocument document
    )
    {
        return new FeedbackResponse
        {
            Id =
                document.Id,

            ConversationId =
                document.ConversationId,

            MessageId =
                document.MessageId,

            Rating =
                document.Rating,

            Comment =
                document.Comment,

            CreatedAtUtc =
                document.CreatedAtUtc,

            UpdatedAtUtc =
                document.UpdatedAtUtc
        };
    }
}