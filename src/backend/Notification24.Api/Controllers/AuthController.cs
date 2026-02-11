using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Notification24.Api.Extensions;
using Notification24.Application.Auth;
using Notification24.Infrastructure.Identity;

namespace Notification24.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;

    public AuthController(UserManager<AppUser> userManager)
    {
        _userManager = userManager;
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<SessionResponse>> GetSession()
    {
        var currentUserId = User.GetUserId();

        var user = await _userManager.FindByIdAsync(currentUserId.ToString());
        if (user is null)
        {
            return Unauthorized("No local user mapping found for the authenticated Firebase account.");
        }

        var roles = await _userManager.GetRolesAsync(user);

        return Ok(new SessionResponse
        {
            UserId = user.Id,
            FirebaseUid = user.FirebaseUid,
            UserName = user.UserName ?? string.Empty,
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            Roles = roles
        });
    }
}
