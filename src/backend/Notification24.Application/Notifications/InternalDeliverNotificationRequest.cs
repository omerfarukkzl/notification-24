namespace Notification24.Application.Notifications;

public sealed class InternalDeliverNotificationRequest
{
    public Guid NotificationId { get; set; }

    public Guid RecipientUserId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;
}
