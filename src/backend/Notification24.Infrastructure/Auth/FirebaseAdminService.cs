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

    private readonly FirebaseAuth _firebaseAuth;

    public FirebaseAdminService(IOptions<FirebaseOptions> options)
    {
        var firebaseOptions = options.Value;
        if (string.IsNullOrWhiteSpace(firebaseOptions.ProjectId))
        {
            throw new InvalidOperationException("Firebase:ProjectId is required.");
        }

        lock (Sync)
        {
            _app ??= CreateOrGetApp(firebaseOptions);
        }

        _firebaseAuth = FirebaseAuth.GetAuth(_app);
    }

    public async Task<string> CreateUserAsync(string email, string password, string displayName, CancellationToken cancellationToken = default)
    {
        var args = new UserRecordArgs
        {
            Email = email,
            Password = password,
            DisplayName = displayName,
            EmailVerified = true,
            Disabled = false
        };

        var record = await _firebaseAuth.CreateUserAsync(args, cancellationToken);
        return record.Uid;
    }

    public Task UpdateUserAsync(string uid, string email, string displayName, string? password, CancellationToken cancellationToken = default)
    {
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

        return _firebaseAuth.UpdateUserAsync(args, cancellationToken);
    }

    public Task DeleteUserAsync(string uid, CancellationToken cancellationToken = default)
        => _firebaseAuth.DeleteUserAsync(uid, cancellationToken);

    private static FirebaseApp CreateOrGetApp(FirebaseOptions options)
    {
        const string appName = "notification24";

        var existing = FirebaseApp.GetApps().FirstOrDefault(app => app.Name == appName);
        if (existing is not null)
        {
            return existing;
        }

        GoogleCredential credential;

        if (!string.IsNullOrWhiteSpace(options.ServiceAccountJson))
        {
            credential = GoogleCredential.FromJson(options.ServiceAccountJson);
        }
        else if (!string.IsNullOrWhiteSpace(options.ServiceAccountJsonPath))
        {
            credential = GoogleCredential.FromFile(options.ServiceAccountJsonPath);
        }
        else
        {
            credential = GoogleCredential.GetApplicationDefault();
        }

        return FirebaseApp.Create(new AppOptions
        {
            Credential = credential,
            ProjectId = options.ProjectId
        }, appName);
    }
}
