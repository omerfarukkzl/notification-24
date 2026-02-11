using DotNetEnv;
using Notification24.Worker.Services;

TryLoadDotEnv();

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddHttpClient("api");
builder.Services.AddHostedService<NotificationDispatchWorker>();

var host = builder.Build();
host.Run();

static void TryLoadDotEnv()
{
    try
    {
        Env.TraversePath().Load();
    }
    catch (Exception)
    {
    }
}
