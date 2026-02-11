namespace Notification24.Application.Notifications;

public sealed class NotificationSummaryDto
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }
}
