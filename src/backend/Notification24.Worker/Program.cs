using Notification24.Worker.Services;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddHttpClient("api");
builder.Services.AddHostedService<NotificationDispatchWorker>();

var host = builder.Build();
host.Run();
