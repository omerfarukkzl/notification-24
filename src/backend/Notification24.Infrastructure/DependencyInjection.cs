using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Notification24.Application.Common.Interfaces;
using Notification24.Infrastructure.Auth;
using Notification24.Infrastructure.Configuration;
using Notification24.Infrastructure.Identity;
using Notification24.Infrastructure.Messaging;
using Notification24.Infrastructure.Persistence;
using Notification24.Infrastructure.Presence;
using Notification24.Infrastructure.Repositories;

namespace Notification24.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<FirebaseOptions>(configuration.GetSection(FirebaseOptions.SectionName));
        services.Configure<RabbitMqOptions>(configuration.GetSection(RabbitMqOptions.SectionName));

        var connectionString = configuration.GetConnectionString("Postgres")
            ?? configuration.GetConnectionString("SqlServer")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres is missing.");

        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

        services
            .AddIdentityCore<AppUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<AppRole>()
            .AddEntityFrameworkStores<AppDbContext>();

        services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
        services.AddScoped<IFirebaseAdminService, FirebaseAdminService>();
        services.AddScoped<INotificationQueuePublisher, RabbitMqNotificationQueuePublisher>();
        services.AddSingleton<IPresenceTracker, InMemoryPresenceTracker>();

        return services;
    }
}
