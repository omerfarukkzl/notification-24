namespace Notification24.Domain.Constants;

public static class RabbitMqTopology
{
    public const string Exchange = "notifications";
    public const string Queue = "notification.dispatch.queue";
    public const string RoutingKey = "notification.dispatch";
}
