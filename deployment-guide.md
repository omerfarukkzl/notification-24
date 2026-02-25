# Notification-24 Deployment Guide (Render + Vercel)

Bu rehber, Notification-24 projesinin production kurulumu icin guncel hedefleri anlatir:
- Frontend: Vercel (Angular)
- API: Render Web Service
- Worker: Render Background Worker
- Database: Render PostgreSQL
- Queue: CloudAMQP (RabbitMQ)

## 1) Altyapi Hazirligi

### PostgreSQL (Render)
1. Render'da yeni bir PostgreSQL instance olustur.
2. Connection string bilgisini al.
3. API env'de `ConnectionStrings__Postgres` olarak kullan.

### RabbitMQ (CloudAMQP)
1. CloudAMQP instance olustur.
2. Su degerleri not al:
   - `RabbitMq__HostName`
   - `RabbitMq__Port`
   - `RabbitMq__UserName`
   - `RabbitMq__Password`
   - `RabbitMq__VirtualHost`

### Firebase
1. `Firebase__ProjectId` degerini hazirla.
2. Service account JSON'u tek satir halinde secret olarak tut:
   - `Firebase__ServiceAccountJson`
3. Web app config degerlerini Vercel'e gir:
   - `WEB_FIREBASE_API_KEY`
   - `WEB_FIREBASE_AUTH_DOMAIN`
   - `WEB_FIREBASE_PROJECT_ID`
   - `WEB_FIREBASE_APP_ID`

## 2) Render Servisleri

Repository root'undaki `render.yaml` dosyasi ile su servisleri yonet:
- `notification24-api` (web)
- `notification24-worker` (worker)
- `notification24-postgres` (database)

### API icin zorunlu env
- `ASPNETCORE_ENVIRONMENT=Production`
- `DOTNET_ENVIRONMENT=Production`
- `ConnectionStrings__Postgres`
- `Firebase__ProjectId`
- `Firebase__ServiceAccountJson`
- `RabbitMq__HostName`
- `RabbitMq__Port`
- `RabbitMq__UserName`
- `RabbitMq__Password`
- `RabbitMq__VirtualHost`
- `InternalApi__Key`
- `Seed__AdminUserName`
- `Seed__AdminEmail`
- `Seed__AdminFirebaseUid`
- `Cors__AllowedOrigins__0=https://<vercel-domain>`
- `Database__ApplyMigrationsOnStartup=false`

### Worker icin zorunlu env
- `DOTNET_ENVIRONMENT=Production`
- `RabbitMq__HostName`
- `RabbitMq__Port`
- `RabbitMq__UserName`
- `RabbitMq__Password`
- `RabbitMq__VirtualHost`
- `Api__BaseUrl=https://<api-domain>/`
- `Api__InternalKey=<InternalApi__Key ile ayni>`

## 3) Migration ve Rollout

1. Ilk deploydan once PostgreSQL migration uygula:
```bash
DOTNET_ROLL_FORWARD=Major \
DOTNET_CLI_HOME=/tmp/dotnet \
NUGET_PACKAGES=/tmp/nuget \
dotnet ef database update \
  --project src/backend/Notification24.Infrastructure/Notification24.Infrastructure.csproj \
  --context AppDbContext
```
2. API deploy et, `GET /` endpointini dogrula.
3. Worker deploy et, queue consume loglarini kontrol et.
4. Vercel'e frontend deploy et.
5. Uc uca test et:
   - login
   - user list
   - dispatch
   - inbox/tracking
   - SignalR live updates

## 4) Guvenlik Notlari

- Tum secret'lari platform secret manager'da tut.
- `.env` dosyalarini repoya commit etme.
- `InternalApi__Key` guclu ve rastgele olmalidir.
