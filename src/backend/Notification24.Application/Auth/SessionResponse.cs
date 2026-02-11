namespace Notification24.Application.Auth;

public sealed class SessionResponse
{
    public Guid UserId { get; set; }

    public string FirebaseUid { get; set; } = string.Empty;

    public string UserName { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public IReadOnlyCollection<string> Roles { get; set; } = Array.Empty<string>();
}
