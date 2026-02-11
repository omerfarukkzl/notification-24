using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Notification24.Contracts.Messaging;
using Notification24.Domain.Constants;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Notification24.Worker.Services;

public sealed class NotificationDispatchWorker : BackgroundService
{
    private readonly ILogger<NotificationDispatchWorker> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public NotificationDispatchWorker(
        ILogger<NotificationDispatchWorker> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConsumeLoopAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Worker loop failed. Retrying in 5 seconds.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task ConsumeLoopAsync(CancellationToken cancellationToken)
    {
        var factory = new ConnectionFactory
        {
            HostName = _configuration["RabbitMq:HostName"] ?? "localhost",
            Port = int.TryParse(_configuration["RabbitMq:Port"], out var port) ? port : 5672,
            UserName = _configuration["RabbitMq:UserName"] ?? "guest",
            Password = _configuration["RabbitMq:Password"] ?? "guest",
            VirtualHost = _configuration["RabbitMq:VirtualHost"] ?? "/",
            DispatchConsumersAsync = true
        };

        using var connection = factory.CreateConnection();
        using var channel = connection.CreateModel();

        channel.ExchangeDeclare(RabbitMqTopology.Exchange, ExchangeType.Direct, durable: true, autoDelete: false);
        channel.QueueDeclare(RabbitMqTopology.Queue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(RabbitMqTopology.Queue, RabbitMqTopology.Exchange, RabbitMqTopology.RoutingKey);
        channel.BasicQos(0, 1, false);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.Received += async (_, eventArgs) =>
        {
            try
            {
                var payload = eventArgs.Body.ToArray();
                var message = JsonSerializer.Deserialize<NotificationDispatchMessage>(payload);

                if (message is null)
                {
                    throw new InvalidOperationException("Message could not be deserialized.");
                }

                foreach (var recipientId in message.TargetUserIds.Distinct())
                {
                    await SendDeliveryAsync(message, recipientId, cancellationToken);
                }

                channel.BasicAck(eventArgs.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Message processing failed and was requeued.");
                channel.BasicNack(eventArgs.DeliveryTag, multiple: false, requeue: true);
            }
        };

        var consumerTag = channel.BasicConsume(
            queue: RabbitMqTopology.Queue,
            autoAck: false,
            consumer: consumer);

        _logger.LogInformation("Notification worker started consuming from queue: {Queue}", RabbitMqTopology.Queue);

        while (!cancellationToken.IsCancellationRequested)
        {
            await Task.Delay(1000, cancellationToken);
        }

        channel.BasicCancel(consumerTag);
    }

    private async Task SendDeliveryAsync(NotificationDispatchMessage message, Guid recipientUserId, CancellationToken cancellationToken)
    {
        var baseUrl = _configuration["Api:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new InvalidOperationException("Api:BaseUrl is required for worker delivery.");
        }

        var internalKey = _configuration["Api:InternalKey"];
        if (string.IsNullOrWhiteSpace(internalKey))
        {
            throw new InvalidOperationException("Api:InternalKey is required for worker delivery.");
        }

        var client = _httpClientFactory.CreateClient("api");
        client.BaseAddress = new Uri(baseUrl, UriKind.Absolute);
        client.DefaultRequestHeaders.Remove("X-Internal-Key");
        client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);

        var response = await client.PostAsJsonAsync("api/notifications/internal/deliver", new
        {
            message.NotificationId,
            RecipientUserId = recipientUserId,
            message.Title,
            message.Body
        }, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Delivery call failed for recipient {recipientUserId}. Status={(int)response.StatusCode}, Body={body}");
        }
    }
}
