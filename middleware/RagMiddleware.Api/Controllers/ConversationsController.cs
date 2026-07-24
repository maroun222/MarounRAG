using Microsoft.AspNetCore.Mvc;
using RagMiddleware.Application.Abstractions.Persistence;
using RagMiddleware.Application.Contracts.Conversations;
using RagMiddleware.Domain.Entities;

namespace RagMiddleware.Api.Controllers;

[ApiController]
[Route("api/conversations")]
public sealed class ConversationsController : ControllerBase
{
    private const string UserIdHeaderName = "X-User-Id";

    private readonly IConversationRepository
        _conversationRepository;

    public ConversationsController(
        IConversationRepository conversationRepository
    )
    {
        _conversationRepository = conversationRepository;
    }

    // ========================================================
    // Create conversation
    // ========================================================

    [HttpPost]
    [ProducesResponseType<ConversationSummaryResponse>(
        StatusCodes.Status201Created
    )]
    [ProducesResponseType(
        StatusCodes.Status401Unauthorized
    )]
    public async Task<ActionResult<ConversationSummaryResponse>>
        CreateConversation(
            [FromBody] CreateConversationRequest request,
            CancellationToken cancellationToken
        )
    {
        string? userId = GetCurrentUserId();

        if (userId is null)
        {
            return MissingUserResponse();
        }

        DateTime now = DateTime.UtcNow;

        string title = string.IsNullOrWhiteSpace(
            request.Title
        )
            ? "New conversation"
            : request.Title.Trim();

        var conversation = new Conversation
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Title = title,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        await _conversationRepository.CreateConversationAsync(
            conversation,
            cancellationToken
        );

        ConversationSummaryResponse response =
            ToConversationSummary(conversation);

        return CreatedAtAction(
            nameof(GetConversation),
            new
            {
                id = conversation.Id
            },
            response
        );
    }

    // ========================================================
    // List conversations
    // ========================================================

    [HttpGet]
    [ProducesResponseType<
        IReadOnlyList<ConversationSummaryResponse>
    >(StatusCodes.Status200OK)]
    [ProducesResponseType(
        StatusCodes.Status401Unauthorized
    )]
    public async Task<
        ActionResult<IReadOnlyList<ConversationSummaryResponse>>
    > ListConversations(
        CancellationToken cancellationToken
    )
    {
        string? userId = GetCurrentUserId();

        if (userId is null)
        {
            return MissingUserResponse();
        }

        IReadOnlyList<Conversation> conversations =
            await _conversationRepository
                .ListConversationsAsync(
                    userId,
                    cancellationToken
                );

        ConversationSummaryResponse[] response =
            conversations
                .Select(ToConversationSummary)
                .ToArray();

        return Ok(response);
    }

    // ========================================================
    // Get one conversation and its messages
    // ========================================================

    [HttpGet("{id}")]
    [ProducesResponseType<ConversationDetailResponse>(
        StatusCodes.Status200OK
    )]
    [ProducesResponseType(
        StatusCodes.Status401Unauthorized
    )]
    [ProducesResponseType(
        StatusCodes.Status404NotFound
    )]
    public async Task<ActionResult<ConversationDetailResponse>>
        GetConversation(
            string id,
            CancellationToken cancellationToken
        )
    {
        string? userId = GetCurrentUserId();

        if (userId is null)
        {
            return MissingUserResponse();
        }

        Conversation? conversation =
            await _conversationRepository
                .GetConversationAsync(
                    id,
                    userId,
                    cancellationToken
                );

        if (conversation is null)
        {
            return NotFound(
                new
                {
                    error = "Conversation not found."
                }
            );
        }

        IReadOnlyList<ConversationMessage> messages =
            await _conversationRepository
                .ListMessagesAsync(
                    id,
                    userId,
                    cancellationToken
                );

        return Ok(
            new ConversationDetailResponse
            {
                Id = conversation.Id,
                Title = conversation.Title,
                CreatedAtUtc = conversation.CreatedAtUtc,
                UpdatedAtUtc = conversation.UpdatedAtUtc,
                Messages = messages
                    .Select(ToMessageResponse)
                    .ToArray()
            }
        );
    }

    // ========================================================
    // Add a message
    // ========================================================

    [HttpPost("{id}/messages")]
    [ProducesResponseType<ConversationMessageResponse>(
        StatusCodes.Status201Created
    )]
    [ProducesResponseType(
        StatusCodes.Status401Unauthorized
    )]
    [ProducesResponseType(
        StatusCodes.Status404NotFound
    )]
    public async Task<ActionResult<ConversationMessageResponse>>
        AddMessage(
            string id,
            [FromBody] AddConversationMessageRequest request,
            CancellationToken cancellationToken
        )
    {
        string? userId = GetCurrentUserId();

        if (userId is null)
        {
            return MissingUserResponse();
        }

        Conversation? conversation =
            await _conversationRepository
                .GetConversationAsync(
                    id,
                    userId,
                    cancellationToken
                );

        if (conversation is null)
        {
            return NotFound(
                new
                {
                    error = "Conversation not found."
                }
            );
        }

        DateTime now = DateTime.UtcNow;

        var message = new ConversationMessage
        {
            Id = Guid.NewGuid().ToString("N"),
            ConversationId = id,
            UserId = userId,
            Role = request.Role.Trim().ToLowerInvariant(),
            Content = request.Content.Trim(),
            Page = request.Page,
            Context = request.Context,
            RetrievalContext = request.RetrievalContext,
            CacheHit = request.CacheHit,
            Timings = request.Timings,
            CreatedAtUtc = now
        };

        await _conversationRepository.AddMessageAsync(
            message,
            cancellationToken
        );

        await _conversationRepository
            .UpdateConversationTimestampAsync(
                id,
                userId,
                now,
                cancellationToken
            );

        return StatusCode(
            StatusCodes.Status201Created,
            ToMessageResponse(message)
        );
    }

    // ========================================================
    // Helpers
    // ========================================================

    private string? GetCurrentUserId()
    {
        string value = Request.Headers[
            UserIdHeaderName
        ].FirstOrDefault()?.Trim() ?? string.Empty;

        return string.IsNullOrWhiteSpace(value)
            ? null
            : value;
    }

    private ActionResult MissingUserResponse()
    {
        return Unauthorized(
            new
            {
                error = (
                    $"The {UserIdHeaderName} header is required " +
                    "during development."
                )
            }
        );
    }

    private static ConversationSummaryResponse
        ToConversationSummary(
            Conversation conversation
        )
    {
        return new ConversationSummaryResponse
        {
            Id = conversation.Id,
            Title = conversation.Title,
            CreatedAtUtc = conversation.CreatedAtUtc,
            UpdatedAtUtc = conversation.UpdatedAtUtc
        };
    }

    private static ConversationMessageResponse
        ToMessageResponse(
            ConversationMessage message
        )
    {
        return new ConversationMessageResponse
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            Role = message.Role,
            Content = message.Content,
            Page = message.Page,
            Context = message.Context,
            RetrievalContext = message.RetrievalContext,
            Sources = message.Sources
    .Select(
        source =>
            new ConversationSourceResponse
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
            CacheHit = message.CacheHit,
            Timings = message.Timings,
            CreatedAtUtc = message.CreatedAtUtc
        };
    }
}