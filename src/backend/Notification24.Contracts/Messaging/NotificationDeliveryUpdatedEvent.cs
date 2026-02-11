namespace Notification24.Contracts.Messaging;

public sealed class NotificationDeliveryUpdatedEvent
{
    public Guid NotificationId { get; set; }

    public Guid RecipientUserId { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime? DeliveredAtUtc { get; set; }
}
