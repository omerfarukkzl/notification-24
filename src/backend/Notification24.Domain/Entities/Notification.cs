namespace Notification24.Domain.Entities;

public sealed class Notification
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public Guid SenderUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<NotificationRecipient> Recipients { get; set; } = new List<NotificationRecipient>();
}
