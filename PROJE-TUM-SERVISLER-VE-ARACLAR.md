# CardMatch – Tüm Servisler, Sunucular ve Araçlar (Check Listesi)

Projede kullanılan **sunucular, harici servisler, SMS, email, push, depolama, IAP, auth** vb. hepsini sırayla listeliyoruz. Teste çıkarken veya “nerede ne kullanıyoruz?” diye bakarken bu listeyi takip edebilirsin.

---

## 1. Sunucu / Hosting

| Servis | Ne için? | Nerede tanımlı? | Kontrol |
|--------|----------|------------------|--------|
| **Render** | Backend (Node/Express) canlıda burada çalışıyor | `eas.json` production: `API_URL` / `SOCKET_URL` = `https://cardmatchapp.onrender.com` | [Render Dashboard](https://dashboard.render.com) → CardMatch servisi çalışıyor mu? |
| **Expo EAS (expo.dev)** | iOS/Android build, proje, build geçmişi | `app.config.js` → `extra.eas.projectId` | [expo.dev](https://expo.dev) → proje → Builds |
| **Admin panel** | Next.js admin; nerede host edildiği projede sabit değil | `admin/.env.example` → `NEXT_PUBLIC_API_URL` | Admin’i nerede deploy ettiysen (Vercel vb.) orada kontrol et |

---

## 2. Veritabanı

| Servis | Ne için? | Env / Config | Kontrol |
|--------|----------|--------------|--------|
| **PostgreSQL** | Tüm uygulama verisi (Prisma) | Server: `DATABASE_URL` (örn. `postgresql://...`) | Render’da “Postgres” ekli mi? Yoksa başka bir PostgreSQL (Supabase, Neon vb.) kullanıyorsan o hesabı kontrol et. `server/.env` içinde `DATABASE_URL` doğru mu? |

---

## 3. SMS (Telefon Doğrulama / OTP)

| Servis | Ne için? | Kodda kullanım | Env değişkenleri | Kontrol |
|--------|----------|----------------|------------------|--------|
| **Twilio Verify** | Telefon numarasına OTP gönderme ve doğrulama | `server/src/services/sms.ts`, `server/src/routes/auth.ts` | `TWILIO_ACCOUNT_SID`<br>`TWILIO_AUTH_TOKEN`<br>`TWILIO_VERIFY_SERVICE_SID` | [Twilio Console](https://console.twilio.com) → Verify → Service SID; server `.env`’de bu üçü dolu mu? |

**Not:** `server/.env.example` içinde Netgsm alanları var; **kodda kullanılan SMS altyapısı Twilio Verify.** Netgsm’i kullanmıyorsan .env.example’ı ileride Twilio’ya göre güncelleyebilirsin.

---

## 4. E-posta

| Servis | Ne için? | Kodda kullanım | Env değişkenleri | Kontrol |
|--------|----------|----------------|------------------|--------|
| **Resend** | E-posta gönderme (doğrulama, hoş geldin vb.) | `server/src/services/email.ts`, `server/src/routes/auth.ts` | `RESEND_API_KEY`<br>`EMAIL_FROM` (opsiyonel; yoksa `onboarding@resend.dev`) | [Resend](https://resend.com) → API Keys; production’da `RESEND_API_KEY` ve mümkünse kendi domain’inle `EMAIL_FROM` |

**Not:** `NODE_ENV !== 'production'` iken kod e-posta göndermiyor, sadece logluyor. Test için `ENABLE_TEST_OTP` kullanılıyorsa auth tarafında test OTP devreye girebilir.

---

## 5. Push Bildirimleri

| Servis | Ne için? | Kodda kullanım | Env? | Kontrol |
|--------|----------|----------------|------|--------|
| **Expo Push (exp.host)** | Mobil uygulamaya push gönderme | `server/src/services/push.ts` → `https://exp.host/--/api/v2/push/send` | Sunucu tarafında özel env yok; cihazdan gelen `expoPushToken` kullanılıyor | Mobil uygulama push token’ı kaydediyor mu? Backend’de ilgili kullanıcıda `expoPushToken` var mı? |

---

## 6. Depolama (Dosya / Medya)

| Servis | Ne için? | Kodda kullanım | Env değişkenleri | Kontrol |
|--------|----------|----------------|------------------|--------|
| **Cloudinary** | Fotoğraf/video yükleme (profil, medya) | `server/src/services/cloudinary.ts`, upload ile ilgili route’lar | `CLOUDINARY_CLOUD_NAME`<br>`CLOUDINARY_API_KEY`<br>`CLOUDINARY_API_SECRET` | [Cloudinary Dashboard](https://cloudinary.com/console) → API Keys; server `.env` |
| **AWS S3** | Doğrulama videoları (verification video) | `server/src/services/verification.ts` | `AWS_S3_BUCKET`<br>`AWS_REGION` (örn. `eu-central-1`)<br>`AWS_ACCESS_KEY_ID`<br>`AWS_SECRET_ACCESS_KEY` | AWS IAM + S3 bucket; server `.env`. S3 yoksa kod local fallback yapıyor (URL’i `/uploads/...` olarak kaydediyor). |

---

## 7. Sesli / Görüntülü Arama

| Servis | Ne için? | Nerede? | Env değişkenleri | Kontrol |
|--------|----------|---------|------------------|--------|
| **Agora** | Sesli ve görüntülü arama | Server: token üretimi (`server/src/services/agora.ts`, `server/src/routes/agora.ts`). Mobil: `react-native-agora`, `mobile/src/services/agora.ts` | **Server:** `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`<br>**Mobile:** `EXPO_PUBLIC_AGORA_APP_ID` (build anında; EAS Secrets veya .env) | [Agora Console](https://console.agora.io) → App ID ve Certificate; server + mobil build’de bu değerler set mi? |

---

## 8. Ödeme / IAP (Uygulama İçi Satın Alma)

| Servis | Ne için? | Nerede? | Env / Config | Kontrol |
|--------|----------|---------|--------------|--------|
| **Apple App Store / StoreKit** | iOS IAP (elmas, boost, prime) | Mobil: `expo-iap`, `IAPProviderReal`, `iapProducts.ts` | Mobil: `app.config.js` → `extra.iapProductIds` (veya .env `EXPO_PUBLIC_IAP_*`). Build’de EAS Secrets / app.config ile gömülü. | App Store Connect → In-App Purchases; Product ID’ler uygulamadakiyle birebir aynı mı? |
| **RevenueCat** | IAP doğrulama / abonelik (opsiyonel; backend’de kullanılıyor) | Server: `server/src/routes/subscription.ts`, `server/src/routes/tokens.ts` | **Server:** `REVENUECAT_API_KEY`, `SUBSCRIPTION_VALIDATION_URL`, `TOKEN_PURCHASE_VALIDATION_URL`<br>**Mobile:** `REVENUECAT_PUBLIC_KEY` (app.config.js / .env) | RevenueCat dashboard; server’da bu URL’ler ve API key dolu mu? (Yoksa ilgili endpoint’ler 500 döner.) |

---

## 9. Kimlik Doğrulama (Auth)

| Servis | Ne için? | Nerede? | Env / Config | Kontrol |
|--------|----------|---------|--------------|--------|
| **JWT (kendi sunucumuz)** | Oturum; access / refresh token | `server/src/utils/jwt.ts` | **Server:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (kod bunları kullanıyor; .env.example’da bazen `JWT_SECRET` yazıyor – kodla uyumlu olanı kullan) | Production’da güçlü, benzersiz secret’lar set mi? |
| **Google OAuth** | Google ile giriş | Server: `server/src/routes/auth.ts` (google-auth-library). Mobil: `app.config.js` → Google client ID’ler | **Server:** `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`<br>**Mobile:** `GOOGLE_EXPO_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID` | Google Cloud Console → OAuth client’lar; server + mobil (EAS/build) env’de aynı ID’ler mi? |
| **Apple (Sign in / IAP)** | Apple ile giriş, iOS IAP | Mobil: `expo-apple-authentication`, IAP tarafı yukarıda | Apple Developer, App Store Connect | Apple ID ile giriş ve TestFlight/IAP için gerekli sözleşmeler tamam mı? |

---

## 10. iOS TestFlight / App Store

| Araç / Hesap | Ne için? | Nerede tanımlı? | Detay |
|--------------|----------|-----------------|-------|
| **EAS Build + Submit** | .ipa üretimi, TestFlight’a yükleme | `mobile/eas.json`, `mobile/package.json` script’leri | Ayrıntılı liste: `mobile/IOS-TESTFLIGHT-ARAÇLAR-CHECK.md` |
| **App Store Connect** | Uygulama, TestFlight, IAP ürünleri | `eas.json` → `ascAppId`, `appleId`, `appleTeamId` | appstoreconnect.apple.com |
| **Apple Developer** | Sertifika, provisioning | EAS, Apple ID ile yönetiyor | developer.apple.com |

---

## 11. Diğer Sunucu Tarafı Env’ler

| Değişken | Amaç |
|----------|------|
| `PORT` | Sunucu portu (Render genelde kendi atar). |
| `CLIENT_ORIGIN` | CORS izin verilen origin (production’da gerçek domain). |
| `BASE_URL` | Bazı upload/URL üretimlerinde kullanılıyor (`server/src/routes/upload.ts`). Production’da `https://cardmatchapp.onrender.com` gibi. |
| `NODE_ENV` | `production` / development; log, email, test OTP davranışı buna göre. |
| `ENABLE_TEST_OTP` | `'true'` ise e-posta OTP test modu (auth). |

---

## 12. Mobil Tarafı Env’ler (Build / Runtime)

| Değişken | Amaç | Nerede kullanılır? |
|----------|------|---------------------|
| `API_URL` | Backend API adresi | EAS production’da `eas.json` ile set; lokal .env |
| `SOCKET_URL` | WebSocket adresi | Aynı şekilde |
| `EXPO_PUBLIC_AGORA_APP_ID` | Agora uygulama ID (mobil) | Build anında `app.config.js` → `extra.agoraAppId` |
| `EXPO_PUBLIC_IAP_*` | IAP product ID override | Build anında `app.config.js` → `extra.iapProductIds` |
| `REVENUECAT_PUBLIC_KEY` | RevenueCat public key (mobil) | app.config.js |
| `GOOGLE_*_CLIENT_ID` | Google OAuth client ID’ler | app.config.js |

**Not:** Mobil production build’de `.env` EAS’a yüklenmez; sadece `eas.json` içindeki `env` ve EAS Secrets kullanılır. Bu yüzden production’da `API_URL` / `SOCKET_URL` zaten `eas.json`’da.

---

## 13. Özet Tablo (Hangi Servis Nerede?)

| Kategori | Servis | Proje yeri |
|----------|--------|------------|
| Hosting | Render | Backend canlı URL |
| Hosting | Expo EAS | Mobil build |
| Veritabanı | PostgreSQL | Server `DATABASE_URL` |
| SMS | Twilio Verify | Server sms.ts, auth.ts |
| E-posta | Resend | Server email.ts, auth.ts |
| Push | Expo Push | Server push.ts |
| Depolama | Cloudinary | Server cloudinary.ts |
| Depolama | AWS S3 | Server verification.ts |
| Arama | Agora | Server + mobil |
| IAP | Apple StoreKit + (opsiyonel) RevenueCat | Mobil + server subscription/tokens |
| Auth | JWT, Google OAuth, Apple | Server jwt, auth; mobil config |
| iOS dağıtım | EAS Submit, App Store Connect, TestFlight | mobile/eas.json, Apple hesaplar |

---

Bu listeyi sırayla gidip “SMS kullanıyoruz, Twilio’yu check ettik; sunucular Render’da; veritabanı şu PostgreSQL” gibi tek tek işaretleyebilirsin. Eksik veya yanlış gördüğün bir satırı not alırsan, ona göre güncelleyebiliriz.
