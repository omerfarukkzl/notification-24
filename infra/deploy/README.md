# Deployment Notes (Free-Tier Focus)

## Target
- Frontend: Vercel
- API: Azure App Service (or Render fallback)
- Worker: Azure WebJob / Render background worker
- Database: Azure SQL
- Queue: CloudAMQP free plan

## Required Secrets
- `Firebase__ProjectId`
- `Firebase__ServiceAccountJsonPath` or `Firebase__ServiceAccountJson`
- `ConnectionStrings__SqlServer`
- `RabbitMq__HostName`, `RabbitMq__Port`, `RabbitMq__UserName`, `RabbitMq__Password`, `RabbitMq__VirtualHost`
- `InternalApi__Key`
- `Seed__AdminFirebaseUid`

## API App Settings Example
- `ASPNETCORE_ENVIRONMENT=Production`
- `Database__ApplyMigrationsOnStartup=true`
- `Cors__AllowedOrigins__0=https://<your-vercel-domain>`

## Worker App Settings Example
- `Api__BaseUrl=https://<api-domain>/`
- `Api__InternalKey=<same-key-as-api>`
