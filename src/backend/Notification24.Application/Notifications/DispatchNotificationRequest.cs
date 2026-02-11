namespace Notification24.Application.Notifications;

public sealed class DispatchNotificationRequest
{
    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string TargetMode { get; set; } = "selected";

    public IReadOnlyCollection<Guid> UserIds { get; set; } = Array.Empty<Guid>();
}
