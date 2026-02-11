using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Notification24.Api.Extensions;
using Notification24.Application.Common.Interfaces;
using Notification24.Application.Users;
using Notification24.Domain.Constants;
using Notification24.Infrastructure.Identity;

namespace Notification24.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class UsersController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly IFirebaseAdminService _firebaseAdminService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        UserManager<AppUser> userManager,
        IFirebaseAdminService firebaseAdminService,
        ILogger<UsersController> logger)
    {
        _userManager = userManager;
        _firebaseAdminService = firebaseAdminService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<UserListItemDto>>> GetUsers(CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();
        var isAdmin = User.IsAdmin();

        var query = _userManager.Users.AsNoTracking();
        if (!isAdmin)
        {
            query = query.Where(user => user.CreatedByUserId == currentUserId || user.Id == currentUserId);
        }

        var users = await query
            .OrderBy(user => user.UserName)
            .Select(user => new UserListItemDto
            {
                Id = user.Id,
                UserName = user.UserName ?? string.Empty,
                Email = user.Email ?? string.Empty,
                FullName = user.FullName,
                CreatedByUserId = user.CreatedByUserId,
                IsOnline = user.IsOnline,
                LastSeenAtUtc = user.LastSeenAtUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(users);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserListItemDto>> GetUser(Guid id, CancellationToken cancellationToken)
    {
        var user = await _userManager.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        if (!CanManage(user, User.GetUserId(), User.IsAdmin()))
        {
            return Forbid();
        }

        return Ok(new UserListItemDto
        {
            Id = user.Id,
            UserName = user.UserName ?? string.Empty,
            Email = user.Email ?? string.Empty,
            FullName = user.FullName,
            CreatedByUserId = user.CreatedByUserId,
            IsOnline = user.IsOnline,
            LastSeenAtUtc = user.LastSeenAtUtc
        });
    }

    [HttpPost]
    public async Task<ActionResult<UserListItemDto>> CreateUser([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UserName) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.FullName))
        {
            return BadRequest("UserName, FullName, Email and Password are required.");
        }

        var currentUserId = User.GetUserId();

        string firebaseUid;
        try
        {
            firebaseUid = await _firebaseAdminService.CreateUserAsync(
                request.Email.Trim(),
                request.Password,
                request.FullName.Trim(),
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Firebase user create failed for email {Email}", request.Email);
            return BadRequest($"Firebase user could not be created: {ex.Message}");
        }

        var user = new AppUser
        {
            UserName = request.UserName.Trim(),
            Email = request.Email.Trim(),
            FullName = request.FullName.Trim(),
            FirebaseUid = firebaseUid,
            EmailConfirmed = true,
            CreatedByUserId = currentUserId,
            CreatedAtUtc = DateTime.UtcNow,
            IsOnline = false
        };

        var createResult = await _userManager.CreateAsync(user);
        if (!createResult.Succeeded)
        {
            await _firebaseAdminService.DeleteUserAsync(firebaseUid, cancellationToken);
            return BadRequest(createResult.Errors.Select(error => error.Description));
        }

        await _userManager.AddToRoleAsync(user, RoleNames.User);

        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, new UserListItemDto
        {
            Id = user.Id,
            UserName = user.UserName ?? string.Empty,
            Email = user.Email ?? string.Empty,
            FullName = user.FullName,
            CreatedByUserId = user.CreatedByUserId,
            IsOnline = false,
            LastSeenAtUtc = null
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return NotFound();
        }

        if (!CanManage(user, User.GetUserId(), User.IsAdmin()))
        {
            return Forbid();
        }

        user.FullName = string.IsNullOrWhiteSpace(request.FullName) ? user.FullName : request.FullName.Trim();
        user.Email = string.IsNullOrWhiteSpace(request.Email) ? user.Email : request.Email.Trim();

        try
        {
            await _firebaseAdminService.UpdateUserAsync(user.FirebaseUid, user.Email ?? string.Empty, user.FullName, request.Password, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Firebase user update failed for local user {UserId}", id);
            return BadRequest($"Firebase user could not be updated: {ex.Message}");
        }

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(error => error.Description));
        }

        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return NotFound();
        }

        if (user.Id == currentUserId)
        {
            return BadRequest("You cannot delete your own user.");
        }

        if (!CanManage(user, currentUserId, User.IsAdmin()))
        {
            return Forbid();
        }

        try
        {
            await _firebaseAdminService.DeleteUserAsync(user.FirebaseUid, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Firebase user delete failed for local user {UserId}", id);
            return BadRequest($"Firebase user could not be deleted: {ex.Message}");
        }

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(error => error.Description));
        }

        return NoContent();
    }

    private static bool CanManage(AppUser target, Guid currentUserId, bool isAdmin)
        => isAdmin || target.CreatedByUserId == currentUserId;
}
