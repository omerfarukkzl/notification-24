using Notification24.Domain.Enums;

namespace Notification24.Domain.Entities;

public sealed class NotificationRecipient
{
    public Guid NotificationId { get; set; }

    public Notification Notification { get; set; } = null!;

    public Guid RecipientUserId { get; set; }

    public NotificationDeliveryStatus DeliveryStatus { get; set; } = NotificationDeliveryStatus.Pending;

    public DateTime? DeliveredAtUtc { get; set; }

    public DateTime? ReadAtUtc { get; set; }
}
