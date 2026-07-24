using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RagMiddleware.Application.Contracts.Feedback;

public sealed class SubmitFeedbackRequest
{
    [Required]
    [JsonPropertyName("conversation_id")]
    public string ConversationId { get; init; } =
        string.Empty;

    [Required]
    [JsonPropertyName("message_id")]
    public string MessageId { get; init; } =
        string.Empty;

    [Required]
    [RegularExpression(
        "^(up|down)$",
        ErrorMessage = "Rating must be either 'up' or 'down'."
    )]
    [JsonPropertyName("rating")]
    public string Rating { get; init; } =
        string.Empty;

    [StringLength(1000)]
    [JsonPropertyName("comment")]
    public string? Comment { get; init; }
}