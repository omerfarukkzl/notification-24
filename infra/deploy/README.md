# Deployment Notes

## Runtime Baseline
- Backend runtime: `.NET 10` (`net10.0`)
- Frontend runtime: `Node.js 20` + `pnpm 9`

## Target
- Frontend: Vercel
- API: Render Web Service (embedded queue worker)
- Database: Render PostgreSQL
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
- `ConnectionStrings__Postgres`
- `Firebase__ProjectId`
- `Firebase__ServiceAccountJson` (recommended)
- `Worker__Enabled=true`
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

## Production Config Files
- API defaults: `src/backend/Notification24.Api/appsettings.Production.json`
- Environment template: `infra/deploy/.env.production.example`
- Render blueprint: `render.yaml`
- Replace all `replace-with-*` placeholders before first production release.

## Rollout Checklist
1. Create Render PostgreSQL and map `ConnectionStrings__Postgres`.
2. Deploy API with all production app settings.
3. Validate API root endpoint: `GET /`.
4. Run schema migration in a controlled step, then keep `Database__ApplyMigrationsOnStartup=false`.
5. Deploy Web on Vercel with `WEB_*` variables.
6. Validate login, dispatch, inbox/tracking and SignalR live updates end-to-end.
