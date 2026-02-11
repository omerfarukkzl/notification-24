using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Notification24.Api.Extensions;
using Notification24.Api.Hubs;
using Notification24.Api.Models;
using Notification24.Application.Common.Interfaces;
using Notification24.Application.Notifications;
using Notification24.Contracts.Messaging;
using Notification24.Domain.Entities;
using Notification24.Domain.Enums;
using Notification24.Infrastructure.Identity;
using Notification24.Infrastructure.Persistence;

namespace Notification24.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class NotificationsController : ControllerBase
{
    private const string InternalApiHeaderName = "X-Internal-Key";

    private readonly IRepository<Notification> _notificationRepository;
    private readonly IRepository<NotificationRecipient> _recipientRepository;
    private readonly AppDbContext _dbContext;
    private readonly UserManager<AppUser> _userManager;
    private readonly INotificationQueuePublisher _queuePublisher;
    private readonly IHubContext<PresenceHub> _hubContext;
    private readonly IConfiguration _configuration;

    public NotificationsController(
        IRepository<Notification> notificationRepository,
        IRepository<NotificationRecipient> recipientRepository,
        AppDbContext dbContext,
        UserManager<AppUser> userManager,
        INotificationQueuePublisher queuePublisher,
        IHubContext<PresenceHub> hubContext,
        IConfiguration configuration)
    {
        _notificationRepository = notificationRepository;
        _recipientRepository = recipientRepository;
        _dbContext = dbContext;
        _userManager = userManager;
        _queuePublisher = queuePublisher;
        _hubContext = hubContext;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<NotificationSummaryDto>>> GetNotificationSummaries(CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();
        var isAdmin = User.IsAdmin();

        var query = _dbContext.Notifications.AsNoTracking();
        if (!isAdmin)
        {
            query = query.Where(x => x.SenderUserId == currentUserId);
        }

        var notifications = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new NotificationSummaryDto
            {
                Id = x.Id,
                Title = x.Title,
                CreatedAtUtc = x.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(notifications);
    }

    [HttpGet("tracking/{notificationId:guid}")]
    public async Task<ActionResult<IReadOnlyCollection<NotificationTrackingRowDto>>> GetTrackingRows(Guid notificationId, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();
        var isAdmin = User.IsAdmin();

        var notification = await _dbContext.Notifications.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == notificationId, cancellationToken);

        if (notification is null)
        {
            return NotFound();
        }

        if (!isAdmin && notification.SenderUserId != currentUserId)
        {
            return Forbid();
        }

        var usersQuery = _userManager.Users.AsNoTracking();
        if (!isAdmin)
        {
            usersQuery = usersQuery.Where(x => x.CreatedByUserId == currentUserId || x.Id == currentUserId);
        }

        var recipients = await _dbContext.NotificationRecipients.AsNoTracking()
            .Where(x => x.NotificationId == notificationId)
            .ToDictionaryAsync(x => x.RecipientUserId, cancellationToken);

        var users = await usersQuery
            .OrderBy(x => x.UserName)
            .ToListAsync(cancellationToken);

        var result = users
            .Select(user =>
            {
                recipients.TryGetValue(user.Id, out var recipient);

                return new NotificationTrackingRowDto
                {
                    UserId = user.Id,
                    UserName = user.UserName ?? string.Empty,
                    FullName = user.FullName,
                    IsOnline = user.IsOnline,
                    HasReceived = recipient is not null,
                    DeliveryStatus = recipient?.DeliveryStatus ?? NotificationDeliveryStatus.Pending,
                    DeliveredAtUtc = recipient?.DeliveredAtUtc
                };
            })
            .ToList();

        return Ok(result);
    }

    [HttpGet("inbox")]
    public async Task<ActionResult<IReadOnlyCollection<InboxNotificationDto>>> GetInbox(CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();

        var inbox = await _dbContext.NotificationRecipients
            .AsNoTracking()
            .Include(x => x.Notification)
            .Where(x => x.RecipientUserId == currentUserId)
            .OrderByDescending(x => x.Notification.CreatedAtUtc)
            .Select(x => new InboxNotificationDto
            {
                NotificationId = x.NotificationId,
                Title = x.Notification.Title,
                Body = x.Notification.Body,
                CreatedAtUtc = x.Notification.CreatedAtUtc,
                DeliveryStatus = x.DeliveryStatus,
                DeliveredAtUtc = x.DeliveredAtUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(inbox);
    }

    [HttpPost("dispatch")]
    public async Task<ActionResult> Dispatch([FromBody] DispatchNotificationRequest request, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();
        var isAdmin = User.IsAdmin();

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Body))
        {
            return BadRequest("Title and body are required.");
        }

        var mode = request.TargetMode?.Trim().ToLowerInvariant() ?? "selected";
        IQueryable<AppUser> targetQuery;

        if (isAdmin)
        {
            targetQuery = _userManager.Users.AsNoTracking().Where(user => user.Id != currentUserId);
        }
        else
        {
            targetQuery = _userManager.Users.AsNoTracking().Where(user => user.CreatedByUserId == currentUserId);
        }

        if (mode == "selected")
        {
            var selectedIds = request.UserIds.Distinct().ToArray();
            if (selectedIds.Length == 0)
            {
                return BadRequest("At least one user must be selected.");
            }

            targetQuery = targetQuery.Where(user => selectedIds.Contains(user.Id));
        }
        else if (mode != "all")
        {
            return BadRequest("TargetMode must be either 'selected' or 'all'.");
        }

        var targetUserIds = await targetQuery
            .Select(user => user.Id)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (targetUserIds.Count == 0)
        {
            return BadRequest("No target users available for this request.");
        }

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Body = request.Body.Trim(),
            SenderUserId = currentUserId,
            CreatedAtUtc = DateTime.UtcNow
        };

        var recipients = targetUserIds
            .Select(userId => new NotificationRecipient
            {
                NotificationId = notification.Id,
                RecipientUserId = userId,
                DeliveryStatus = NotificationDeliveryStatus.Pending
            })
            .ToList();

        await _notificationRepository.AddAsync(notification, cancellationToken);
        await _recipientRepository.AddRangeAsync(recipients, cancellationToken);
        await _notificationRepository.SaveChangesAsync(cancellationToken);

        await _queuePublisher.PublishDispatchAsync(new NotificationDispatchMessage
        {
            NotificationId = notification.Id,
            SenderUserId = currentUserId,
            Title = notification.Title,
            Body = notification.Body,
            TargetUserIds = targetUserIds,
            CreatedAtUtc = notification.CreatedAtUtc
        }, cancellationToken);

        return Ok(new
        {
            notificationId = notification.Id,
            recipientCount = targetUserIds.Count
        });
    }

    [HttpPost("acknowledge/{notificationId:guid}")]
    public async Task<IActionResult> Acknowledge(Guid notificationId, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();

        var recipient = await _dbContext.NotificationRecipients
            .FirstOrDefaultAsync(x => x.NotificationId == notificationId && x.RecipientUserId == currentUserId, cancellationToken);

        if (recipient is null)
        {
            return NotFound();
        }

        recipient.DeliveryStatus = NotificationDeliveryStatus.Read;
        recipient.ReadAtUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("internal/deliver")]
    public async Task<IActionResult> DeliverInternal([FromBody] InternalDeliverNotificationRequest request, CancellationToken cancellationToken)
    {
        var configuredInternalKey = _configuration[$"{InternalApiOptions.SectionName}:Key"];
        var headerValue = Request.Headers[InternalApiHeaderName].ToString();

        if (string.IsNullOrEmpty(configuredInternalKey) || configuredInternalKey != headerValue)
        {
            return Unauthorized();
        }

        var recipient = await _dbContext.NotificationRecipients
            .FirstOrDefaultAsync(x => x.NotificationId == request.NotificationId && x.RecipientUserId == request.RecipientUserId, cancellationToken);

        if (recipient is null)
        {
            return NotFound();
        }

        if (recipient.DeliveryStatus == NotificationDeliveryStatus.Pending)
        {
            recipient.DeliveryStatus = NotificationDeliveryStatus.Delivered;
            recipient.DeliveredAtUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        var recipientUser = await _userManager.Users.AsNoTracking()
            .FirstOrDefaultAsync(user => user.Id == request.RecipientUserId, cancellationToken);

        if (recipientUser?.IsOnline == true)
        {
            await _hubContext.Clients
                .Group(PresenceHub.GroupForUser(request.RecipientUserId))
                .SendAsync("NotificationReceived", new
                {
                    notificationId = request.NotificationId,
                    title = request.Title,
                    body = request.Body,
                    atUtc = recipient.DeliveredAtUtc ?? DateTime.UtcNow
                }, cancellationToken);
        }

        await _hubContext.Clients.All.SendAsync("NotificationDeliveryUpdated", new NotificationDeliveryUpdatedEvent
        {
            NotificationId = request.NotificationId,
            RecipientUserId = request.RecipientUserId,
            Status = recipient.DeliveryStatus.ToString(),
            DeliveredAtUtc = recipient.DeliveredAtUtc
        }, cancellationToken);

        return Accepted();
    }
}
