using Notification24.Domain.Enums;

namespace Notification24.Application.Notifications;

public sealed class InboxNotificationDto
{
    public Guid NotificationId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }

    public NotificationDeliveryStatus DeliveryStatus { get; set; }

    public DateTime? DeliveredAtUtc { get; set; }
}
