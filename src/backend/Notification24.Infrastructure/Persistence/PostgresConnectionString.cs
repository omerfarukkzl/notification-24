using Npgsql;

namespace Notification24.Infrastructure.Persistence;

internal static class PostgresConnectionString
{
    public static string Normalize(string rawConnectionString)
    {
        if (string.IsNullOrWhiteSpace(rawConnectionString))
        {
            return rawConnectionString;
        }

        var value = rawConnectionString.Trim();
        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return value;
        }

        var uri = new Uri(value);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort ? 5432 : uri.Port
        };

        var database = uri.AbsolutePath.Trim('/');
        if (!string.IsNullOrWhiteSpace(database))
        {
            builder.Database = database;
        }

        var userInfoParts = uri.UserInfo.Split(':', 2);
        if (userInfoParts.Length >= 1 && !string.IsNullOrWhiteSpace(userInfoParts[0]))
        {
            builder.Username = Uri.UnescapeDataString(userInfoParts[0]);
        }

        if (userInfoParts.Length == 2)
        {
            builder.Password = Uri.UnescapeDataString(userInfoParts[1]);
        }

        ApplyKnownQueryOptions(builder, uri.Query);
        return builder.ConnectionString;
    }

    private static void ApplyKnownQueryOptions(NpgsqlConnectionStringBuilder builder, string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return;
        }

        var segments = query.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var segment in segments)
        {
            var keyValue = segment.Split('=', 2);
            if (keyValue.Length == 0 || string.IsNullOrWhiteSpace(keyValue[0]))
            {
                continue;
            }

            var key = Uri.UnescapeDataString(keyValue[0]);
            var value = keyValue.Length == 2 ? Uri.UnescapeDataString(keyValue[1]) : string.Empty;

            switch (NormalizeKey(key))
            {
                case "sslmode":
                    if (Enum.TryParse<SslMode>(value, ignoreCase: true, out var sslMode))
                    {
                        builder.SslMode = sslMode;
                    }
                    break;
                case "trustservercertificate":
                    // Npgsql 10+ icin obsolete; parse edilse bile gormezden geliyoruz.
                    break;
                case "pooling":
                    if (bool.TryParse(value, out var pooling))
                    {
                        builder.Pooling = pooling;
                    }
                    break;
            }
        }
    }

    private static string NormalizeKey(string key)
    {
        return key.Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .ToLowerInvariant();
    }
}
