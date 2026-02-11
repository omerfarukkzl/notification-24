using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Identity;
using Notification24.Api.Extensions;
using Notification24.Application.Common.Interfaces;
using Notification24.Infrastructure.Identity;

namespace Notification24.Api.Hubs;

[Authorize]
public sealed class PresenceHub : Hub
{
    private readonly IPresenceTracker _presenceTracker;
    private readonly UserManager<AppUser> _userManager;

    public PresenceHub(IPresenceTracker presenceTracker, UserManager<AppUser> userManager)
    {
        _presenceTracker = presenceTracker;
        _userManager = userManager;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.GetUserId() ?? throw new InvalidOperationException("User not available on hub connection.");
        var now = DateTime.UtcNow;

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupForUser(userId));

        var becameOnline = await _presenceTracker.UserConnectedAsync(userId, Context.ConnectionId);
        if (becameOnline)
        {
            var user = await _userManager.FindByIdAsync(userId.ToString());
            if (user is not null)
            {
                user.IsOnline = true;
                user.LastSeenAtUtc = now;
                await _userManager.UpdateAsync(user);
            }

            await Clients.All.SendAsync("PresenceChanged", new
            {
                userId,
                isOnline = true,
                atUtc = now
            });
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.GetUserId() ?? Guid.Empty;
        if (userId == Guid.Empty)
        {
            await base.OnDisconnectedAsync(exception);
            return;
        }

        var now = DateTime.UtcNow;

        var becameOffline = await _presenceTracker.UserDisconnectedAsync(userId, Context.ConnectionId);
        if (becameOffline)
        {
            var user = await _userManager.FindByIdAsync(userId.ToString());
            if (user is not null)
            {
                user.IsOnline = false;
                user.LastSeenAtUtc = now;
                await _userManager.UpdateAsync(user);
            }

            await Clients.All.SendAsync("PresenceChanged", new
            {
                userId,
                isOnline = false,
                atUtc = now
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    public static string GroupForUser(Guid userId) => $"user:{userId}";
}
