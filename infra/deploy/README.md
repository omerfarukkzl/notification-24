# Deployment Notes

## Runtime Baseline
- Backend runtime: `.NET 10` (`net10.0`)
- Frontend runtime: `Node.js 20` + `pnpm 9`

## Target
- Frontend: Vercel
- API: Azure App Service (or Render fallback)
- Worker: Azure WebJob / Render background worker
- Database: Azure SQL
- Queue: CloudAMQP free plan

## Secret Inventory
### Vercel (Web)
- `WEB_API_BASE_URL`
- `WEB_FIREBASE_API_KEY`
- `WEB_FIREBASE_AUTH_DOMAIN`
- `WEB_FIREBASE_PROJECT_ID`
- `WEB_FIREBASE_APP_ID`

### API App Settings
- `ASPNETCORE_ENVIRONMENT=Production`
- `DOTNET_ENVIRONMENT=Production`
- `ConnectionStrings__SqlServer`
- `Firebase__ProjectId`
- `Firebase__ServiceAccountJson` (recommended)
- `RabbitMq__HostName`
- `RabbitMq__Port`
- `RabbitMq__UserName`
- `RabbitMq__Password`
- `RabbitMq__VirtualHost`
- `InternalApi__Key`
- `Seed__AdminUserName`
- `Seed__AdminEmail`
- `Seed__AdminFirebaseUid`
- `Cors__AllowedOrigins__0=https://<your-vercel-domain>`
- `Database__ApplyMigrationsOnStartup=false`

### Worker App Settings
- `DOTNET_ENVIRONMENT=Production`
- `RabbitMq__HostName`
- `RabbitMq__Port`
- `RabbitMq__UserName`
- `RabbitMq__Password`
- `RabbitMq__VirtualHost`
- `Api__BaseUrl=https://<api-domain>/`
- `Api__InternalKey=<same-key-as-api/InternalApi__Key>`

## Production Config Files
- API defaults: `src/backend/Notification24.Api/appsettings.Production.json`
- Worker defaults: `src/backend/Notification24.Worker/appsettings.Production.json`
- Environment template: `infra/deploy/.env.production.example`
- Replace all `replace-with-*` placeholders before first production release.

## Rollout Checklist
1. Deploy API with all production app settings.
2. Validate API root endpoint: `GET /`.
3. Run schema migration in a controlled step, then keep `Database__ApplyMigrationsOnStartup=false`.
4. Deploy Worker and verify queue consume + `api/notifications/internal/deliver` flow.
5. Deploy Web on Vercel with `WEB_*` variables.
6. Validate login, dispatch, inbox/tracking and SignalR live updates end-to-end.
