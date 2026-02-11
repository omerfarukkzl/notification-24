using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Notification24.Application.Common.Interfaces;
using Notification24.Contracts.Messaging;
using Notification24.Domain.Constants;
using Notification24.Infrastructure.Configuration;
using RabbitMQ.Client;

namespace Notification24.Infrastructure.Messaging;

public sealed class RabbitMqNotificationQueuePublisher : INotificationQueuePublisher
{
    private readonly RabbitMqOptions _options;

    public RabbitMqNotificationQueuePublisher(IOptions<RabbitMqOptions> options)
    {
        _options = options.Value;
    }

    public Task PublishDispatchAsync(NotificationDispatchMessage message, CancellationToken cancellationToken = default)
    {
        var factory = new ConnectionFactory
        {
            HostName = _options.HostName,
            Port = _options.Port,
            UserName = _options.UserName,
            Password = _options.Password,
            VirtualHost = _options.VirtualHost,
            DispatchConsumersAsync = true
        };

        using var connection = factory.CreateConnection();
        using var channel = connection.CreateModel();

        channel.ExchangeDeclare(RabbitMqTopology.Exchange, ExchangeType.Direct, durable: true, autoDelete: false);
        channel.QueueDeclare(RabbitMqTopology.Queue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(RabbitMqTopology.Queue, RabbitMqTopology.Exchange, RabbitMqTopology.RoutingKey);

        var payload = JsonSerializer.SerializeToUtf8Bytes(message);
        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;

        channel.BasicPublish(
            exchange: RabbitMqTopology.Exchange,
            routingKey: RabbitMqTopology.RoutingKey,
            mandatory: false,
            basicProperties: properties,
            body: payload);

        return Task.CompletedTask;
    }
}
