# 1.0.3’ten 1.0.4’e – Yapılan Tüm Değişiklikler

Bu dosya, **1.0.3 build’i** ile **1.0.4** arasında yapılan tüm ekleme ve düzeltmeleri listeler.

---

## 1. IAP – App Store Ürün ID’leri (SKU not found düzeltmesi)

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| App Store Connect ile birebir ID’ler | `iapProducts.ts`, `app.config.js` | Elmas: `com.cardmatch.app.tokens_50`, `tokens_100`, `tokens_250`. Boost: `com.cardmatch.app.boost_1h`. Prime: `com.cardmatch.app.prime_weekly2`, `prime_monthly`, `prime_yearly2`. "SKU not found" bu ID’lerle giderildi. |

---

## 2. Agora – Sesli / Görüntülü Arama (Gerçek SDK + Secure Mode)

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| react-native-agora | `package.json` | Gerçek ses/video akışı için SDK eklendi. |
| Agora servisi | `src/services/agora.ts` | Engine init/join/leave, mute/hoparlör/video, uzak kullanıcı callback’leri. Token ile join (Secure Mode). |
| Arama ekranı | `FriendCallScreen.tsx` | Bağlandığında kanala katılma, yerel/uzak video (RtcSurfaceView), mikrofon/hoparlör/kamera butonları Agora’ya bağlı. |
| Backend token | `server/src/routes/agora.ts` | GET `/api/agora/token?channelName=xxx&uid=xxx` – giriş yapmış kullanıcı için RTC token (1 saat). |
| Agora env | `server/.env`, `mobile/.env` | `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` (server); `EXPO_PUBLIC_AGORA_APP_ID` (mobile). |

---

## 3. Cinsiyet Tercihi – Kadın / Herkes / Erkek (30 dk, 50 elmas)

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| Ana sayfada cinsiyet seçimi | `HomeScreen.tsx` | "Eşleşme Bul" butonunun hemen altında **Kadın (♀)** / **Herkes (🌐)** / **Erkek (♂)**. Kadın veya Erkek seçilince 50 elmas ile 30 dakika cinsiyet filtresi. |
| 30 dk sayaç | `HomeScreen.tsx` | Kadın/Erkek tercihi aktifken kalan süre gösterilir; süre bitince otomatik "Herkes"e döner. |
| Eşleşme ayarlarından kaldırıldı | `MatchSettingsScreen.tsx` | Cinsiyet tercihi bu ekrandan kaldırıldı; sadece Ana sayfada. |
| Backend | `server` (user/me) | `filterGender`, `filterGenderExpiresAt` – 50 elmas kesimi ve 30 dk süre. |

---

## 4. Profil Fotoğrafı – Görünüm ve Akış

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| Arkadaşlar / Sıralama fotoğrafları | `FriendsScreen.tsx`, `LeaderboardScreen.tsx` | `ProfilePhoto` + `getPhotoUrl` ile doğru URL ve hata durumunda placeholder (siyah ekran önlenir). |
| Avatar seçimi – Prime foto yükleme | `AvatarSelectionScreen.tsx` | Prime kullanıcı galeriden foto yükleyince başarı mesajında "Tamam"a basınca **Profil ekranına** dönüş (siyah ekran olmaz). |
| Avatar ekranı görsel | `AvatarSelectionScreen.tsx` | Özel profil fotoğrafı alanında **ProfilePhoto** kullanımı; yükleme hatasında placeholder. |

---

## 5. Build

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| iOS build numarası | `app.config.js` | **buildNumber: '1.0.4'**. |

---

## Özet (1.0.4’te ne var?)

1. **IAP:** App Store’daki gerçek ürün ID’leri; elmas / boost / prime satın alma düzgün çalışır.
2. **Agora:** Gerçek sesli ve görüntülü arama, Secure Mode (backend’den token).
3. **Cinsiyet tercihi:** Ana sayfada Kadın/Herkes/Erkek, 50 elmas 30 dk, sayaç.
4. **Profil fotoğrafı:** Arkadaşlar/sıralama doğru gösterim; Prime foto yükleme sonrası Profil’e dönüş.

Bu liste 1.0.3 build’i ile şu ana kadar yapılan tüm değişiklikleri kapsar.
