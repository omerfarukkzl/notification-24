namespace Notification24.Application.Common.Interfaces;

public interface IFirebaseAdminService
{
    Task<string> CreateUserAsync(string email, string password, string displayName, CancellationToken cancellationToken = default);

    Task UpdateUserAsync(string uid, string email, string displayName, string? password, CancellationToken cancellationToken = default);

    Task DeleteUserAsync(string uid, CancellationToken cancellationToken = default);
}
