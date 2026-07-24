using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts.Conversations;

public sealed class CreateConversationRequest
{
    [StringLength(120, MinimumLength = 1)]
    [JsonPropertyName("title")]
    public string? Title { get; init; }
}