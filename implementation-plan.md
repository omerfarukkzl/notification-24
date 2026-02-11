# Bildirim Uygulaması Monorepo Planı (Ücretsiz Odaklı, PRD Uyumlu)

  ## Özet


  - Frontend: Angular (Ag-Grid, SignalR client), Vercel deploy
  - Backend: ASP.NET Core Web API + SignalR + Identity/JWT, Azure App Service deploy
  - Worker: .NET Worker Service (RabbitMQ consumer), Azure WebJob/Container background process
  - DB: Azure SQL Server (code-first EF Core)
  - Queue: CloudAMQP free RabbitMQ
  - Auth: Firebase Auth

  Kapsam: tek fazda tam PRD (auth/role, kullanıcı CRUD, bildirim gönderim, online-offline, bildirim takip
  ## Mimari ve Repo Yapısı
  Önerilen monorepo:
  - apps/web (Angular)
  - apps/worker (.NET Worker, RabbitMQ consumer)
  - packages/contracts (DTO, event adları, sabitler)
  - packages/config (ortak lint/tsconfig/style presets)
  - infra (docker-compose local, deploy dokümanları, IaC scriptleri)

  Katmanlı backend:

  - Domain
  - Infrastructure (EF Core, Identity, RabbitMQ producer)
  - Presentation (API + Hub)


  Seçilen yön:

  - Aesthetic: Swiss/International
  - Unutulmaz öğe: Bildirim gönderiminden sonra grid satırlarında “live delivery pulse” (anlık teslim
    animasyonu + durum etiketi geçişi)

  - Tipografi: Instrument Serif (başlık) + DM Sans (gövde)
  - Düzen: asimetrik dashboard hissi, 3 ekran:
      1. Login
      2. Kullanıcı yönetimi + toplu seçim + bildirim gönder popup
      3. Bildirim takip ekranı (üstte select, altta kullanıcı grid; alanlar yeşil)
  - A11y: klavye navigasyonu, 44x44 etkileşim hedefleri, kontrast > 4.5:1


  REST (v1):

  - POST /api/auth/refresh (opsiyonel ama önerilen)
  - GET /api/users (Admin: tümü, User: kendi oluşturdukları)
  - DELETE /api/users/{id}
  - GET /api/notifications
  - POST /api/notifications/dispatch (targetMode: selected|all, userIds[], title, body)

  SignalR Hub:
  - /hubs/presence (online/offline ve canlı bildirim eventleri)
      - PresenceChanged(userId, isOnline, atUtc)
      - NotificationReceived(notificationId, title, body, atUtc)
      - NotificationDeliveryUpdated(notificationId, userId, status, atUtc)
  RabbitMQ contract:
  - Exchange: notifications
  - Routing key: notification.dispatch
  - Queue: notification.dispatch.queue
  - Message: NotificationDispatchMessage { notificationId, senderUserId, targetUserIds[], title, body,
    createdAtUtc }


  - UserProfile (CreatedByUserId, display alanları)
  - Notification (Title, Body, SenderUserId, CreatedAtUtc)
  - NotificationRecipient (NotificationId, RecipientUserId, DeliveryStatus, DeliveredAtUtc, ReadAtUtc)
  - PresenceSession (UserId, ConnectionId, IsOnline, LastSeenAtUtc)


  - Varsayılan admin kullanıcı seed
  - Yeni eklenen kullanıcı default User rolü
  ## Güvenlik ve Yetkilendirme
  - .NET Identity + JWT access token
  - Policy-based authorization:
      - Admin: tüm kullanıcıları görebilir/yönetebilir/gönderim yapabilir
      - User: yalnızca kendi oluşturduğu kullanıcıları görür ve onlara gönderir
  - API tarafında owner-based filtreleme zorunlu
  - Frontend’de sadece UX-level disable; asıl kontrol backend’de

  ## Dağıtım Planı (Ücretsiz Odak)
  - Frontend: Vercel (Angular static build)
  - Worker: Azure tarafında ayrı background process (cost-limit için düşük kaynak)
  - Queue: CloudAMQP free

  Ortamlar:

  - dev (local docker-compose ile SQL Server + RabbitMQ)
  - prod (Vercel + Azure + CloudAMQP)


      - Frontend lint/test/build
      - API test/build
      - Worker test/build
      - Vercel auto-deploy (web)
  - Secret yönetimi: Vercel env + Azure App Settings

  ## Test Planı ve Kabul Senaryoları
  Fonksiyonel:
  1. Admin login -> tüm kullanıcıları listeler, online/offline kolonunu görür.
  2. User login -> sadece kendi oluşturduğu kullanıcıları görür.
  3. Tekli/çoklu/tüm seçim ile bildirim gönderimi çalışır.
  4. Aktif kullanıcı bildirimi anlık alır (SignalR popup/toast).
  5. Offline kullanıcı tekrar login olduğunda bekleyen bildirimi görür.
  6. Takip ekranında bildirim seçildiğinde alan kullanıcılar yeşil görünür.
  7. Grid ve takip ekranı anlık güncellenir.

  Yetki/Güvenlik:

  1. User, başka kullanıcının kayıtlarına erişemez (API 403/filtered).
  2. JWT süresi dolunca yeniden kimlik doğrulama akışı çalışır.


  1. RabbitMQ geçici kesinti: retry/backoff + log doğrulaması.
  2. Worker restart sonrası kuyruktaki mesajların işlenmeye devam etmesi.
  3. SignalR reconnect sonrası presence bilgisinin düzelmesi.

  ## Uygulama Adımları (Karar-Tamam)

  1. Monorepo bootstrap (Nx + pnpm), app/package iskeletleri.
  3. Auth ve users API’lerinin tamamlanması.
  6. Worker consumer + delivery status persistence.
  7. Angular login + guard + token yönetimi.
  8. Angular kullanıcı gridi (Ag-Grid), CRUD popup, selection logic.
  9. Bildirim gönder popup + disabled state + optimistic UI.
  ## Varsayımlar ve Seçilen Defaultlar

  - Repo şu an yalnızca prd.md içeriyor; plan sıfırdan kurulum üstünden hazırlanmıştır.
  - Monorepo: Nx + pnpm
  - Hosting: Vercel + Azure App Service + Azure SQL
  - Kapsam: tek fazda tam PRD
  - UI dili: Türkçe
  - Backend framework: modern .NET (LTS) ile PRD uyumlu implementasyon