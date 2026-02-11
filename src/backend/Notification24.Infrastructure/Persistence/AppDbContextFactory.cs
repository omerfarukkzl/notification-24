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

        var connectionString = configuration.GetConnectionString("SqlServer")
            ?? "Server=localhost,1433;Database=Notification24Db;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True;Encrypt=False";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseSqlServer(connectionString);

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
