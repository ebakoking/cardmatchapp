# CardMatch – Proje Toparlama (AI için bağlam)

Bu dosya, sohbetler arasında projeyi ve yaptıklarımızı hatırlamak için tek referans noktasıdır.  
**Yeni bir sohbette bana bağlam vermek için:** sohbete `@PROJE-TOPARLAMA.md` yaz veya bu dosyayı ekle.

---

## 1. Proje yapısı

| Klasör | Teknoloji | Açıklama |
|--------|-----------|----------|
| **mobile/** | React Native (Expo), TypeScript | iOS/Android uygulama; EAS Build ile derleniyor. |
| **server/** | Node.js, Express, Prisma | REST API + Socket.IO; Render’da çalışıyor. |
| **admin/** | Next.js | Yönetim paneli (dashboard, kullanıcılar, raporlar vb.). |

---

## 2. Kullandığımız altyapı ve servisler

| Servis | Ne için | Not |
|--------|---------|-----|
| **Render** | Backend (Web Service) + PostgreSQL | `cardmatchapp.onrender.com`; free tier cold start olabiliyor. |
| **PostgreSQL** | Veritabanı | Render üzerinden (tek DB). |
| **Agora** | Sesli / görüntülü arama | RTC token backend’de üretiliyor (Secure Mode). |
| **Cloudinary** | Medya (foto, video) | Upload URL / API server tarafında. |
| **Expo / EAS** | Build, dağıtım | iOS build → App Store Connect; TestFlight. |
| **App Store Connect** | IAP ürünleri, sürümler | Elmas, Boost, Prime SKU’ları burada tanımlı. |
| **RevenueCat** | Kodda referans var, akışta kullanılmıyor | Ödeme akışı **expo-iap + backend API/socket**; webhook yok. |

Abonelikler: Render (hosting+DB), Agora (arama), Cloudinary (medya), Apple Developer + App Store Connect (uygulama + IAP).  
RevenueCat paneli varsa bile mevcut ödeme akışını etkilemiyor.

---

## 3. Ortam değişkenleri (isimler – şifre yok)

**Server (Render .env):**  
`DATABASE_URL`, `JWT_SECRET`, `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, Cloudinary ve e-posta/SMS ile ilgili değişkenler.

**Mobile (.env):**  
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AGORA_APP_ID`; IAP product ID’ler `app.config.js` > `extra.iapProductIds` ile override edilebiliyor.

---

## 4. Özellikler ve durum

| Özellik | Durum | Kısa not |
|---------|--------|-----------|
| **IAP (Elmas, Boost, Prime)** | Çalışıyor | SKU’lar `iapProducts.ts` ve App Store Connect ile uyumlu. Gerçek ödeme ekranı açılıyor; bakiye/Boost/Prime yansıyor. |
| **Backend receipt doğrulama** | Yapılmıyor | `IAP-VE-ABONELIK-DENETIM-RAPORU.md`’de detay: Elmas/Boost/Prime için server-side receipt/transaction doğrulaması yok; production için risk. |
| **Agora sesli/görüntülü arama** | Entegre | Token `GET /api/agora/token` ile alınıyor; mobil `FriendCallScreen` token ile kanala katılıyor. Cold start / token hatası için Render log ve env kontrol edilmeli. |
| **Profil fotoğrafı yükleme** | Düzeltildi | Prime kullanıcı; multipart istekte `Content-Type` header’ı kaldırıldı (boundary otomatik). |
| **Cinsiyet filtresi (50 elmas, 30 dk)** | Var | Home’da Kadın/Herkes/Erkek; 50 elmas ile 30 dk filtre, backend `filterGender` + `filterGenderExpiresAt`. |
| **Build** | 1.0.4 | iOS App Store Connect’e gönderildi; TestFlight için beklemede. |

---

## 5. Önemli dosyalar

- **IAP:** `mobile/src/constants/iapProducts.ts`, `mobile/app.config.js`, `server/src/routes/user.ts` (purchase-tokens), `server/src/routes/boost.ts`, socket prime.
- **Agora:** `server/src/routes/agora.ts`, `mobile/src/services/agora.ts`, `mobile/src/screens/Friends/FriendCallScreen.tsx`, `mobile/AGORA-SESLI-GORUNTULU-ARAMA.md`.
- **Denetim raporu:** `IAP-VE-ABONELIK-DENETIM-RAPORU.md`.

---

## 6. Bana nasıl hatırlatacaksın?

1. **En pratik:** Yeni sohbette ilk mesajda şunu yaz:  
   **“@PROJE-TOPARLAMA.md oku, CardMatch projesi ve yaptıklarımız bunlar.”**  
   Böylece bu dosya bağlama eklenir ve projeyi yeniden özetleyebilirim.

2. **Belirli bir konu:**  
   “@PROJE-TOPARLAMA.md ve @IAP-VE-ABONELIK-DENETIM-RAPORU.md – IAP tarafında receipt doğrulama ekleyelim.”

3. **Güncelleme:** Bu dosyada yeni servis, özellik veya karar ekledikçe PROJE-TOPARLAMA.md’yi güncelle; bir sonraki sohbette yine `@PROJE-TOPARLAMA.md` ile başla.

Bu dosyayı güncel tuttuğun sürece, her yeni sohbette tek bir referansla (ör. `@PROJE-TOPARLAMA.md`) bana projeyi ve altyapıyı hatırlatmış olursun.
