# 🚀 Notification-24 Deployment Guide

Bu rehber, Notification-24 projesinin backend (.NET 10) ve frontend (Next.js) bileşenlerinin canlıya (production) alınması için gereken adımları içerir.

## 📋 Gereksinimler
- **Backend**: .NET 10 Runtime
- **Frontend**: Node.js 20+ & pnpm 9+
- **Database**: Azure SQL (veya PostgreSQL destekli bir SQL Server)
- **Message Broker**: CloudAMQP (RabbitMQ)
- **Auth & Push**: Firebase Account

---

## 🏗️ Adım 1: Altyapı Hazırlığı

### 1. Database Setup
- Azure SQL üzerinde bir veritabanı oluşturun.
- Connection string'i hazırda tutun. Örn: `Server=tcp:yourserver.database.windows.net,1433;Initial Catalog=Notification24Db;...`

### 2. Message Broker (RabbitMQ) Setup
- [CloudAMQP](https://www.cloudamqp.com/) üzerinden free bir plan (Lemur) oluşturun.
- Hostname, Username, Password ve VirtualHost bilgilerini not edin.

### 3. Firebase Setup
- Firebase Console'dan yeni bir proje oluşturun.
- **Service Account**: Project Settings > Service Accounts kısmından yeni bir JSON anahtarı oluşturun. Bu JSON içeriğini API ayarlarında kullanacağız.
- **Web App**: Web uygulaması ekleyip Firebase config bilgilerini (ApiKey, AuthDomain, vb.) alın.

---

## ⚙️ Adım 2: API & Worker Deployment (Backend)

Backend uygulamaları (.NET 10) için Azure App Service (Windows) kurulumu görünüyor. İşte portal üzerinden yapmanız gerekenler:

### 1. Azure Portal'da Ortam Değişkenleri (Environment Variables)
Azure Portal'da sol menüden **Settings > Environment variables** kısmına gidin ve **App settings** sekmesinde aşağıdaki değerleri "Add" diyerek ekleyin:

| Key | Value / Açıklama |
| :--- | :--- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__SqlServer` | Veritabanı bağlantı cümlesi |
| `Firebase__ProjectId` | Firebase Project ID |
| `Firebase__ServiceAccountJson` | Firebase Service Account JSON içeriği (tek satırda) |
| `RabbitMq__HostName` | RabbitMQ Host |
| `RabbitMq__UserName` | RabbitMQ Username |
| `RabbitMq__Password` | RabbitMQ Password |
| `RabbitMq__VirtualHost` | RabbitMQ VirtualHost |
| `InternalApi__Key` | API/Worker şifresi |
| `PROJECT` | `src/backend/Notification24.Api/Notification24.Api.csproj` (Azure'ın hangi projeyi build edeceğini bilmesi için) |

> [!TIP]
> **Windows** tabanlı App Service'lerde `__` (çift alt çizgi) hiyerarşik ayarlar için kullanılır (örn: `ConnectionStrings:SqlServer` yerine `ConnectionStrings__SqlServer`).

### 2. GitHub Actions Yapılandırması (ÖNEMLİ)
Ekran görüntüsünde GitHub bağlantısı yapılmış görünüyor. Mevcut `.github/workflows/main_notification-24.yml` dosyanızda şu değişiklikleri yapmanız, monorepo yapısında build hatalarını önleyecektir:

`main_notification-24.yml` dosyasındaki build ve publish adımlarını şu şekilde güncelleyin:

```yaml
      - name: Build with dotnet
        run: dotnet build src/backend/Notification24.Api/Notification24.Api.csproj --configuration Release

      - name: dotnet publish
        run: dotnet publish src/backend/Notification24.Api/Notification24.Api.csproj -c Release -o "${{env.DOTNET_ROOT}}/myapp"
```

> [!IMPORTANT]
> Eğer bu değişikliği yapmazsanız, Azure tüm projeleri aynı klasöre basmaya çalışabilir ve uygulama çalışmayabilir. Sadece `Notification24.Api` projesini publish etmek en sağlıklı yöntemdir.

---

## 💻 Adım 3: Web Deployment (Frontend)

Frontend uygulaması için **Vercel** en iyi tercihtir.

### Vercel Yapılandırması

Dashboard üzerinden aşağıdaki projeyi ekleyin ve değişkenleri girin:

| Key | Açıklama |
| :--- | :--- |
| `WEB_API_BASE_URL` | Canlıdaki API domaininiz (örn: `https://api.yourdomain.com`) |
| `WEB_FIREBASE_API_KEY` | Firebase Config |
| `WEB_FIREBASE_AUTH_DOMAIN` | Firebase Config |
| `WEB_FIREBASE_PROJECT_ID` | Firebase Config |
| `WEB_FIREBASE_APP_ID` | Firebase Config |

### Derleme Komutları
- **Build Command**: `pnpm --filter @notification24/web build`
- **Output Directory**: `apps/web/.next`

---

## ✅ Son Kontrol Listesi

1. [ ] API root endpoint çalışıyor mu?
2. [ ] Worker loglarında RabbitMQ bağlantı hatası var mı?
3. [ ] Web arayüzünde login olunabiliyor mu?
4. [ ] Bildirimler SignalR üzerinden canlı akıyor mu?

> [!IMPORTANT]
> Tüm gizli bilgileri (Secret) platformların kendi Vault/Secret Manager sistemlerinde saklayın. `.env` dosyalarını asla repo'ya açık halde pushlamayın.
