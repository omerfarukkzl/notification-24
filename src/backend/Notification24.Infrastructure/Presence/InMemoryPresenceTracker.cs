using System.Collections.Concurrent;
using Notification24.Application.Common.Interfaces;

namespace Notification24.Infrastructure.Presence;

public sealed class InMemoryPresenceTracker : IPresenceTracker
{
    private readonly ConcurrentDictionary<Guid, HashSet<string>> _connections = new();

    public Task<bool> UserConnectedAsync(Guid userId, string connectionId)
    {
        var wasOffline = false;

        _connections.AddOrUpdate(
            userId,
            _ =>
            {
                wasOffline = true;
                return new HashSet<string>(StringComparer.Ordinal) { connectionId };
            },
            (_, existing) =>
            {
                lock (existing)
                {
                    existing.Add(connectionId);
                    wasOffline = existing.Count == 1;
                }

                return existing;
            });

        return Task.FromResult(wasOffline);
    }

    public Task<bool> UserDisconnectedAsync(Guid userId, string connectionId)
    {
        if (!_connections.TryGetValue(userId, out var existing))
        {
            return Task.FromResult(false);
        }

        var isNowOffline = false;

        lock (existing)
        {
            existing.Remove(connectionId);
            if (existing.Count == 0)
            {
                _connections.TryRemove(userId, out _);
                isNowOffline = true;
            }
        }

        return Task.FromResult(isNowOffline);
    }
}
