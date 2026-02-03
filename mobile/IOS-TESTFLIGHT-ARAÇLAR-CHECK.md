# iOS TestFlight’a Çıkarken Kullandığımız Araçlar – Kontrol Listesi

Uygulamayı iOS’ta **TestFlight’a çıkarmak** için kullandığımız programlar ve hesaplar. Hepsini tek tek kontrol edebilirsin.

---

## 1. Yazılım / CLI Araçları

| Araç | Ne işe yarıyor? | Nasıl kontrol edersin? |
|------|------------------|-------------------------|
| **Node.js** | Proje ve EAS CLI çalıştırır | Terminal: `node -v` (v18+ önerilir) |
| **npm** | Bağımlılıklar, script’ler | `npm -v` |
| **EAS CLI** | Build almak (`eas build`), TestFlight’a göndermek (`eas submit`) | `eas --version` (5.x veya üzeri; eas.json’da `">= 5.0.0"`) |
| **Expo SDK** | React Native / Expo projesi | `mobile/package.json` → `"expo": "~54.0.32"` |
| **Xcode (EAS sunucuda)** | iOS .ipa üretir; sen bilgisayarında Xcode kurmana gerek yok, EAS kullanıyor | — |

**EAS CLI yüklü değilse:**

```bash
npm install -g eas-cli
eas login
```

---

## 2. Hesaplar ve Portallar

| Hesap / Portal | Kullanım | Senin projedeki değer |
|----------------|---------|------------------------|
| **Expo (expo.dev)** | EAS Build, proje, build geçmişi | Proje ID: `e5d78c7d-0cd4-4332-9789-513ed87bd31e` (app.config.js `extra.eas.projectId`) |
| **Apple ID** | App Store Connect girişi, TestFlight, sertifikalar | `ebatikkurt@gmail.com` (eas.json `submit.production.ios.appleId`) |
| **App Store Connect** | Uygulama, TestFlight, IAP ürünleri, sözleşmeler | https://appstoreconnect.apple.com |
| **Apple Developer (Team)** | Sertifika / provisioning; EAS bunu Apple ID ile yönetir | Team ID: `D7427WU4AM` (eas.json `submit.production.ios.appleTeamId`) |

**Kontrol:**  
- [expo.dev](https://expo.dev) → giriş yap → projeler → **CardMatch** görünüyor mu?  
- [App Store Connect](https://appstoreconnect.apple.com) → **ebatikkurt@gmail.com** ile giriş → **Uygulamalar** → **CardMatch** (App ID **6758614512**) görünüyor mu?

---

## 3. Proje İçi Yapılandırma (iOS / TestFlight)

| Dosya | Alan | Değer (1.0.8) | Amaç |
|-------|------|----------------|------|
| **app.config.js** | `expo.version` | `0.1.0` | Uygulama sürümü (kullanıcıya gösterilen) |
| **app.config.js** | `expo.ios.buildNumber` | `1.0.8` | Build numarası (TestFlight’ta bu artar) |
| **app.config.js** | `expo.ios.bundleIdentifier` | `com.cardmatch.app` | Apple’da tek uygulama kimliği |
| **eas.json** | `submit.production.ios.appleId` | `ebatikkurt@gmail.com` | Submit sırasında hangi Apple ID |
| **eas.json** | `submit.production.ios.ascAppId` | `6758614512` | App Store Connect’teki uygulama ID’si |
| **eas.json** | `submit.production.ios.appleTeamId` | `D7427WU4AM` | Apple Developer Team |
| **eas.json** | `build.production.env` | `API_URL`, `SOCKET_URL` | Production build’de sunucu adresi |

**Kontrol:**  
- `app.config.js` ve `eas.json` aç; yukarıdaki değerler doğru mu?  
- App Store Connect’te CardMatch’in **Genel** sayfasında **Apple ID** (uygulama) = **6758614512** mi?

---

## 4. Build ve Submit Komutları

| İş | Komut | Nerede çalıştırılır? |
|----|--------|----------------------|
| iOS production build | `eas build --platform ios --profile production` | `mobile/` klasöründe |
| Build + otomatik TestFlight’a gönder | `eas build --platform ios --profile production --auto-submit` | `mobile/` klasöründe |
| Sadece son build’i TestFlight’a gönder | `eas submit --platform ios --latest` | `mobile/` klasöründe |
| Cache’siz temiz build | `eas build --platform ios --profile production --clear-cache` | `mobile/` klasöründe |

**package.json script’leri (mobile):**

- `npm run build:ios` → `eas build --platform ios --profile production`
- `npm run build:ios:submit` → aynı + `--auto-submit`

---

## 5. TestFlight Tarafı (Apple)

| Ne | Açıklama |
|----|-----------|
| **TestFlight uygulaması** | Test kullanıcısı iPhone’da App Store’dan **TestFlight** indirir; CardMatch’i buradan yükler. |
| **App Store Connect → TestFlight** | Build’ler burada görünür; **Internal** / **External** gruplarına atanır. |
| **TestFlight linki (dış test)** | İstersen paylaşırsın; örn. `https://testflight.apple.com/join/xxxx` (projede 2n3qnExQ geçiyordu). |
| **Sandbox Apple ID** | IAP test için; App Store Connect → Users and Access → Sandbox → Testers. Gerçek para alınmaz. |

**Kontrol:**  
- App Store Connect → **TestFlight** → **iOS** → Son build’ler listeleniyor mu?  
- Build’i bir **External** veya **Internal** gruba ekledin mi? (Yoksa testçi yükleyemez.)

---

## 6. IAP (Uygulama İçi Satın Alma) – TestFlight İçin

| Araç / Yer | Ne? |
|------------|-----|
| **App Store Connect → Uygulama → In-App Purchases** | Elmas, Boost, Prime ürünleri; Product ID’ler burada tanımlı (örn. `com.cardmatch.app.tokens_50`). |
| **app.config.js → extra.iapProductIds** | Uygulama bu ID’leri kullanır; App Store Connect ile **birebir aynı** olmalı. |
| **Sandbox test** | iPhone’da Ayarlar → App Store → Sandbox Hesabı → test Apple ID. TestFlight’tan uygulama açıldığında “Environment: Sandbox” ile ödeme alınmaz. |

**Kontrol:**  
- App Store Connect’te In-App Purchases’ta ürünler **Ready to Submit** veya uygun durumda mı?  
- `app.config.js` / `iapProducts.ts` içindeki Product ID’ler App Store Connect’tekiyle aynı mı?

---

## 7. Kısa “Her şey yolunda mı?” Kontrolü

1. **EAS:** `eas --version` → 5.x veya üzeri.  
2. **Giriş:** `eas whoami` → Expo hesabın görünsün.  
3. **Apple:** App Store Connect’e **ebatikkurt@gmail.com** ile giriş yapabiliyor musun?  
4. **Proje:** `cd mobile` → `eas build:configure` (zaten yapılandırılmışsa atla) → `eas.json` ve `app.config.js` açık.  
5. **Build:** `eas build --platform ios --profile production` → build başlıyor, hata vermiyor.  
6. **Submit:** Build bittikten sonra Expo sayfasından **Submit to App Store Connect** veya `eas submit --platform ios --latest`.  
7. **TestFlight:** App Store Connect → TestFlight → iOS’ta yeni build görünüyor, bir gruba atanmış.  
8. **Telefon:** TestFlight uygulamasından CardMatch’i yükle/güncelle → Profil’de “Sürüm 0.1.0 (Build 1.0.8)” yazıyor mu?

Bu listeyi doldurduğunda iOS TestFlight zincirindeki tüm programlar ve hesaplar kontrol edilmiş olur.
