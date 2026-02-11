Kullanıcı bildirim uygulaması
Uygulama İçeriği Uygulama 3 ana ekrandan oluşmalı. İlki login ekranı. Default tanımlanan
bir kullanıcı bilgisi ile oturum açılır. Oturum açıldıktan sonra gelen ekranda
bizi kullanıcı listesini barındıran data grid karşılar. Bu ekranda yeni kullanıcı
ekleme, silme, güncelleme, görüntüleme, sistemden çıkış yapma (logout)
işlemlerinin yanında grid üzerinden seçilen tek bir kullanıcıya yada çoklu
seçim ile birden fazla kullanıcıya yada tüm kullanıcılar seçimi ile tüm
kullanıcılara bildirim gönderilebilmelidir.
Kullanıcı listesi gridinden hangi kullanıcının o an aktif (oturum açtığı)
olduğu anlaşılabilmelidir.
Aktif kullanıcılar bildirimi anlık olarak, aktif olmayanlar ise oturum
açtıklarında gelen bildirimleri almalılardır.
3. Ekran ise bildirim takip ekranıdır. Bu ekranda 2 adet html element
bulunmaktadır. Üstte bildirim başlık bilgilerini tutan bir select altta da diğer
ekrandakinin aynısı kullanıcı bilgilerini tutan data grid. Selectten bildirim
seçildiğinde bu bildirimi alan kullanıcı satırları yeşil renk ile renklendirilmeli
bildirim almayan kullanıcı satırları ise default renginde kalmalıdır. Bu sayfa
kullanıcıların bildirimi alma durumuna göre anlık olarak güncellenmelidir.

Teknolojiler Client Side Angular 7+ (versiyon farketmez),
Server Side .Net Core Web API (2xx, 3xx yada .Net 5),
Socket Teknolojisi SignalR,
ORM Entity Framework Core (Code First)
Veritabanı MS SQL SERVER (Versiyon Farketmez)

Açıklama Katmanlı mimari ile proje geliştirilmeli. Generic Repository Desing
Pattern kullanılmalı. Authentication yönetimi için .Net Core Identity
mekanizması kullanılmalı ve JWT (Json Web Token) yapısı oluşturulmalı.
Yetkilendirme mekanızmasını açıklamak gerekirse; sitemde 2 adet rol
bulunmalıdır. Bu roller default olarak (Veritabanından) tanımlanmalıdır.
Rol isimleri “Admin” ve “User” olmalıdır. Sistemde default olarak
(Veritabanından) 1 adet “Admin” rolüne sahip bir kullanıcı tanımlanır ve ilk
bu kullanıcı ile oturum açılıp yeni kullanıcı kayıtları eklenir. Eklenen her
yeni kullanıcı rolü “User” rolü olmalıdır. Eklenen her yeni kullanıcı oturum
açtığında kendi eklediği kullanıcı bilgilerini grid te görmelidir. Bildirim
gönderirken de bu dikkate alınmalı sadece kendi tanımladığı kullanıcılara
bildirim gönderebilmelidir. “Admin” rolüne sahip kullanıcı ise oturum
açtığında sistemdeki tüm kullanıcı bilgilerini görebilmeli ve her kullanıcıya
bildirim gönderebilmelidir.
Bildirim gönderme sisteminde, gönderilecek bildirim bilgileri RabbitMQ
kuyruk yapısına alınmalı, bildirim gönderme görevini üstlenen bir worker
service göndereciği bildirim bilgilerini bu kuyruktan okuyarak işlemini
yapmalıdır.
Hangi kullanıcı o an aktif ise grid üzerinden anlaşılabilmeli durumunu
açıklamak gerekirse; örneğin grid üzerinde aktiflik bilgisini tutan bir kolon
ve kullanıcı o an oturum açmış ise bu kolonda online, oturumunu kapatmış
ise offline yazmalıdır. Renklendirilebilir.
Angular tarafında grid olarak Ag-Grid (Angular versiyonu)
kullanılmalıdır. Grid üzerinden seçim yapma işlemi de gridin ilk kolonuna
bir checkbox konup istenen satırları seçilerek yapılabilir. Ag-Grid
dökümantasyon sayfasından çok basit bir şekilde gerekli bilgilere

ulaşılabilir. Uygulama ekran yapısı için form lar popup ta tasarlanabilir
silme işlemi “Eminmisiniz ?” şeklinde kullanıcıdan onay alınarak
yapılabilir.Bildirim gönderme formu için ise grid üzerinde bir adet bildirim
gönder butonu olabilir bu butona tıklandığında bir popup ta 1 adet gönder
butonu ve 2 adet text input bildirim başlığı ve bildirim içeriği şeklinde
olabilir, gönder butonuna tıklandığında seçilen kullanıcılara bildirim gider
eğer hiç seçilmiş kullanıcı yok ise gridin üst kısmındaki bildirim gönder
butonu disable halde olur. Bildirimi alan kullanıcı için alınma anı ekran
durumu ise herhangi bir notification js paketi ile kullanıcıya popup alert
yada benzeri bir şekilde bildirim mesajı gösterilebilir.
Uygulamanın stabil çalışması ve yapının güzel tasarlanması ilk
önceliktir. Arayüz öncelik değildir. Ancak güzel bir arayüz yada istenen
fonksiyonlar harici yapılar artı olarak değerlendirilecektir.