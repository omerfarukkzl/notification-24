namespace Notification24.Application.Users;

public sealed class UserListItemDto
{
    public Guid Id { get; set; }

    public string UserName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public Guid? CreatedByUserId { get; set; }

    public bool IsOnline { get; set; }

    public DateTime? LastSeenAtUtc { get; set; }
}
