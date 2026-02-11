using Notification24.Domain.Enums;

namespace Notification24.Application.Notifications;

public sealed class NotificationTrackingRowDto
{
    public Guid UserId { get; set; }

    public string UserName { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public bool IsOnline { get; set; }

    public bool HasReceived { get; set; }

    public NotificationDeliveryStatus DeliveryStatus { get; set; }

    public DateTime? DeliveredAtUtc { get; set; }
}
