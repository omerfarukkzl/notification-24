using Microsoft.AspNetCore.Identity;

namespace Notification24.Infrastructure.Identity;

public sealed class AppUser : IdentityUser<Guid>
{
    public string FirebaseUid { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public Guid? CreatedByUserId { get; set; }

    public bool IsOnline { get; set; }

    public DateTime? LastSeenAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
