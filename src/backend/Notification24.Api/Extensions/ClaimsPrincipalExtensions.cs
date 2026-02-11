using System.Security.Claims;
using Notification24.Domain.Constants;

namespace Notification24.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var rawValue = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue(ClaimTypes.Name)
            ?? principal.FindFirstValue("sub");

        if (!Guid.TryParse(rawValue, out var userId))
        {
            throw new InvalidOperationException("Authenticated user does not have a valid user id claim.");
        }

        return userId;
    }

    public static bool IsAdmin(this ClaimsPrincipal principal)
        => principal.IsInRole(RoleNames.Admin);
}
