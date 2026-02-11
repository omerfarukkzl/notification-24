# Notification24 Monorepo

PRD odaklı kullanıcı bildirim uygulaması:
- Angular frontend (Ag-Grid + Firebase SDK + SignalR client)
- .NET API (Firebase token verification + Role-based authorization)
- .NET Worker (RabbitMQ queue consumer)
- SQL Server (EF Core code-first)

## Repo Layout
- `apps/web`: Angular frontend
- `src/backend/Notification24.Api`: API + SignalR hub
- `src/backend/Notification24.Worker`: RabbitMQ consumer worker
- `src/backend/Notification24.Infrastructure`: EF Core, Identity tables, Firebase Admin integration
- `infra/docker/docker-compose.local.yml`: local SQL Server + RabbitMQ

## Firebase Auth Model
- Frontend login `firebase/auth` SDK ile yapılır.
- Angular her API çağrısında Firebase ID token gönderir.
- API tokenı doğrular (`securetoken.google.com/<projectId>` issuer).
- API token içindeki Firebase UID değerini local `Users.FirebaseUid` ile eşler.
- Yetki (`Admin` / `User`) local role tablosundan uygulanır.

## Local Setup (Tek Komut)
1. `.env` olustur:
```bash
cp .env.example .env
```

2. Gerekli alanlari doldur (`Firebase__ProjectId`, `Firebase__ServiceAccountJsonPath`/`Firebase__ServiceAccountJson`, `Seed__AdminFirebaseUid`, `WEB_FIREBASE_*`).

3. Tum stack'i baslat:
```bash
pnpm dev:up
```

4. Tum stack'i kapat:
```bash
pnpm dev:down
```

- Log dosyalari: `.local/logs`
- API: `http://localhost:5050`
- Frontend: `http://localhost:4200`

## Local Setup (Manuel)
1. `.env` oluştur:
```bash
cp .env.example .env
```
- Gerekli değerleri güncelle:
  - `Firebase__ProjectId`
  - `Firebase__ServiceAccountJsonPath` veya `Firebase__ServiceAccountJson`
  - `Seed__AdminFirebaseUid`
  - `WEB_FIREBASE_*`

2. Infrastructure başlat:
```bash
docker compose -f infra/docker/docker-compose.local.yml up -d
```

3. Paketleri yükle:
```bash
pnpm install
DOTNET_CLI_HOME=/tmp/dotnet NUGET_PACKAGES=/tmp/nuget dotnet restore Notification24.slnx
```

4. API ve Worker çalıştır:
```bash
DOTNET_CLI_HOME=/tmp/dotnet dotnet run --project src/backend/Notification24.Api/Notification24.Api.csproj
DOTNET_CLI_HOME=/tmp/dotnet dotnet run --project src/backend/Notification24.Worker/Notification24.Worker.csproj
```
- API/Worker startup sırasında root `.env` otomatik yüklenir.

5. Frontend çalıştır:
```bash
pnpm --filter @notification24/web start
```
- `prestart` scripti `.env` değerlerinden `apps/web/src/assets/env.js` dosyasını otomatik üretir.
- İstersen frontend için ayrı override dosyası kullanabilirsin:
```bash
cp apps/web/.env.example apps/web/.env
```
- `apps/web/.env`, root `.env` içindeki `WEB_*` değerlerini override eder.

6. İsteğe bağlı migration:
```bash
DOTNET_ROLL_FORWARD=Major DOTNET_CLI_HOME=/tmp/dotnet NUGET_PACKAGES=/tmp/nuget dotnet ef database update --project src/backend/Notification24.Infrastructure/Notification24.Infrastructure.csproj --context AppDbContext
```

## Deployment
- Frontend: Vercel
- API/Worker: Azure App Service (Render alternatif)
- DB: Azure SQL
- Queue: CloudAMQP

Notlar:
- Backend target framework: `net10.0`
- Production appsettings: `src/backend/Notification24.Api/appsettings.Production.json`, `src/backend/Notification24.Worker/appsettings.Production.json`

Detay: `infra/deploy/README.md`.
