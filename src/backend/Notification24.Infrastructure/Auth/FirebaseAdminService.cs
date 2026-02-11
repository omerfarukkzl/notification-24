using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Options;
using Notification24.Application.Common.Interfaces;
using Notification24.Infrastructure.Configuration;

namespace Notification24.Infrastructure.Auth;

public sealed class FirebaseAdminService : IFirebaseAdminService
{
    private static readonly object Sync = new();
    private static FirebaseApp? _app;

    private readonly FirebaseOptions _options;

    public FirebaseAdminService(IOptions<FirebaseOptions> options)
    {
        _options = options.Value;
    }

    public async Task<string> CreateUserAsync(string email, string password, string displayName, CancellationToken cancellationToken = default)
    {
        var firebaseAuth = GetFirebaseAuth();

        var args = new UserRecordArgs
        {
            Email = email,
            Password = password,
            DisplayName = displayName,
            EmailVerified = true,
            Disabled = false
        };

        var record = await firebaseAuth.CreateUserAsync(args, cancellationToken);
        return record.Uid;
    }

    public Task UpdateUserAsync(string uid, string email, string displayName, string? password, CancellationToken cancellationToken = default)
    {
        var firebaseAuth = GetFirebaseAuth();

        var args = new UserRecordArgs
        {
            Uid = uid,
            Email = email,
            DisplayName = displayName,
            EmailVerified = true,
            Disabled = false
        };

        if (!string.IsNullOrWhiteSpace(password))
        {
            args.Password = password;
        }

        return firebaseAuth.UpdateUserAsync(args, cancellationToken);
    }

    public Task DeleteUserAsync(string uid, CancellationToken cancellationToken = default)
    {
        var firebaseAuth = GetFirebaseAuth();
        return firebaseAuth.DeleteUserAsync(uid, cancellationToken);
    }

    private FirebaseAuth GetFirebaseAuth()
    {
        if (string.IsNullOrWhiteSpace(_options.ProjectId))
        {
            throw new InvalidOperationException("Firebase:ProjectId is required.");
        }

        FirebaseApp? app;

        lock (Sync)
        {
            if (_app is null)
            {
                _app = CreateOrGetApp(_options);
            }

            app = _app;
        }

        if (app is null)
        {
            throw new InvalidOperationException("Firebase Admin app could not be initialized.");
        }

        return FirebaseAuth.GetAuth(app);
    }

    private static FirebaseApp CreateOrGetApp(FirebaseOptions options)
    {
        const string appName = "notification24";

        try
        {
            var existing = FirebaseApp.GetInstance(appName);
            if (existing is not null)
            {
                return existing;
            }
        }
        catch (ArgumentException)
        {
            // Create below when the named app does not exist yet.
        }

        GoogleCredential credential = BuildCredential(options);

        try
        {
            return FirebaseApp.Create(new AppOptions
            {
                Credential = credential,
                ProjectId = options.ProjectId
            }, appName);
        }
        catch (ArgumentException)
        {
            // Ayni isimle baska thread/process tarafindan olusturulmus olabilir.
            var existing = FirebaseApp.GetInstance(appName);
            if (existing is not null)
            {
                return existing;
            }

            throw new InvalidOperationException("Firebase Admin app could not be initialized.");
        }
    }

    private static GoogleCredential BuildCredential(FirebaseOptions options)
    {
        var inlineJson = options.ServiceAccountJson?.Trim();
        if (!string.IsNullOrWhiteSpace(inlineJson))
        {
            if (inlineJson.StartsWith("{", StringComparison.Ordinal))
            {
                return GoogleCredential.FromJson(inlineJson);
            }

            // Siklikla dosya yolu yanlislikla ServiceAccountJson alanina yaziliyor.
            var inlineAsPath = Path.GetFullPath(inlineJson);
            if (File.Exists(inlineAsPath))
            {
                return GoogleCredential.FromFile(inlineAsPath);
            }

            throw new InvalidOperationException(
                "Firebase:ServiceAccountJson raw JSON olmalidir. Dosya yolu vereceksen Firebase:ServiceAccountJsonPath kullan.");
        }

        if (!string.IsNullOrWhiteSpace(options.ServiceAccountJsonPath))
        {
            var fullPath = ResolveServiceAccountPath(options.ServiceAccountJsonPath);
            return GoogleCredential.FromFile(fullPath);
        }

        return GoogleCredential.GetApplicationDefault();
    }

    private static string ResolveServiceAccountPath(string configuredPath)
    {
        var value = configuredPath.Trim();
        var candidates = new List<string>();

        if (Path.IsPathRooted(value))
        {
            candidates.Add(Path.GetFullPath(value));
        }
        else
        {
            // Primary candidate: path as configured from current working directory.
            candidates.Add(Path.GetFullPath(value));

            // Fallback: if path was written as repo-relative while process already runs in API project folder.
            var fileName = Path.GetFileName(value);
            if (!string.IsNullOrWhiteSpace(fileName))
            {
                candidates.Add(Path.GetFullPath(fileName));
            }
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var candidate in candidates)
        {
            if (!seen.Add(candidate))
            {
                continue;
            }

            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new InvalidOperationException($"Firebase service account file not found. Checked paths: {string.Join(", ", candidates)}");
    }
}
