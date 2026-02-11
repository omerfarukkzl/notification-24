namespace Notification24.Application.Users;

public sealed class UpdateUserRequest
{
    public string Email { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string? Password { get; set; }
}
