namespace Notification24.Contracts.Messaging;

public sealed class NotificationDispatchMessage
{
    public Guid NotificationId { get; set; }

    public Guid SenderUserId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public IReadOnlyCollection<Guid> TargetUserIds { get; set; } = Array.Empty<Guid>();

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
