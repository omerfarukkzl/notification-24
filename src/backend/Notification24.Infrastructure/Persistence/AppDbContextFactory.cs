using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Notification24.Infrastructure.Persistence;

public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        TryLoadDotEnv();

        var basePath = Directory.GetCurrentDirectory();

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("src/backend/Notification24.Api/appsettings.json", optional: true)
            .AddJsonFile("src/backend/Notification24.Api/appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("Postgres")
            ?? configuration.GetConnectionString("SqlServer")
            ?? "Host=localhost;Port=5432;Database=Notification24Db;Username=postgres;Password=postgres;SSL Mode=Disable";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new AppDbContext(optionsBuilder.Options);
    }

    private static void TryLoadDotEnv()
    {
        try
        {
            Env.TraversePath().Load();
        }
        catch (Exception)
        {
        }
    }
}
