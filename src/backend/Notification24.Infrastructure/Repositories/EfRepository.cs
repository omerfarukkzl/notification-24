using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Notification24.Application.Common.Interfaces;
using Notification24.Infrastructure.Persistence;

namespace Notification24.Infrastructure.Repositories;

public sealed class EfRepository<TEntity> : IRepository<TEntity>
    where TEntity : class
{
    private readonly AppDbContext _dbContext;

    public EfRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public IQueryable<TEntity> Query() => _dbContext.Set<TEntity>().AsQueryable();

    public Task<TEntity?> GetAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default)
        => _dbContext.Set<TEntity>().FirstOrDefaultAsync(predicate, cancellationToken);

    public Task AddAsync(TEntity entity, CancellationToken cancellationToken = default)
        => _dbContext.Set<TEntity>().AddAsync(entity, cancellationToken).AsTask();

    public Task AddRangeAsync(IEnumerable<TEntity> entities, CancellationToken cancellationToken = default)
        => _dbContext.Set<TEntity>().AddRangeAsync(entities, cancellationToken);

    public void Update(TEntity entity) => _dbContext.Set<TEntity>().Update(entity);

    public void Remove(TEntity entity) => _dbContext.Set<TEntity>().Remove(entity);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => _dbContext.SaveChangesAsync(cancellationToken);
}
