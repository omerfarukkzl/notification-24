using Notification24.Contracts.Messaging;

namespace Notification24.Application.Common.Interfaces;

public interface INotificationQueuePublisher
{
    Task PublishDispatchAsync(NotificationDispatchMessage message, CancellationToken cancellationToken = default);
}
