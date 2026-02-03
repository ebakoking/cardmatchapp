# Kadın/Erkek Filtreli Eşleşme – Değişen Dosyalar, Minimal Diff, Test & Servis Checklist

---

## 1. Değişen dosyalar

| Dosya | Değişiklik |
|-------|------------|
| **mobile/src/screens/Home/HomeScreen.tsx** | Tek kaynak (expiresAt) ile isActive/remaining; açılışta süre dolmuşsa anında reset; UI isActive kullanımı; debug overlay (__DEV__). |
| **server/** | Değişiklik yok. Match zaten `effectiveFilterGender` ile süre kontrolü yapıyor; auth `/api/auth/me` süre dolmuşsa BOTH dönüyor. |

---

## 2. Minimal diff özeti (HomeScreen)

- **SOURCE OF TRUTH:** `expiresAtMs = user?.filterGenderExpiresAt ? new Date(...).getTime() : 0`; `isGenderFilterActive = (FEMALE|MALE) && expiresAtMs > 0 && Date.now() < expiresAtMs`.
- **remainingSecondsForDisplay:** Sadece UI için; `isGenderFilterActive && genderSecondsLeft != null ? genderSecondsLeft : 0` (interval her saniye `genderSecondsLeft` güncelliyor; karar mekanizması timestamp).
- **Effect:** `!isGenderFilter || !expiresAt` → `setGenderSecondsLeft(null)`; **`initialSecs <= 0`** → hemen `mergeUserFromApi(BOTH)`, `refreshProfileRef.current()`, `setGenderSecondsLeft(null)`, return (interval yok). Böylece uygulama açıldığında süre dolmuşsa 1 sn beklemeden Herkes’e döner.
- **UI seçili durum:** Kadın/Herkes/Erkek “active” görünümü artık `isGenderFilterActive && user?.filterGender === 'FEMALE'` (ve MALE / Herkes) ile; süre bitince veya app tekrar açılınca `isGenderFilterActive` false olur, Herkes seçili görünür.
- **Sayaç metni:** `remainingSecondsForDisplay > 0` iken MM:SS; yoksa “50 💎”.
- **Debug overlay:** `__DEV__` iken `active=… expiresAt=… remaining=…s` (TestFlight production build’de görünmez; istersen kaldırılabilir veya flag ile açılabilir).

---

## 3. Test senaryoları (zorunlu)

| # | Adım | Beklenen |
|---|------|----------|
| 1 | App aç → Ana sayfa | Herkes seçili, random match. |
| 2 | 50 elmas → Kadın seç → onayla | Sayaç 30:00 başlar, Kadın seçili, match sadece kadın. |
| 3 | App’ten çık, ~5 dk sonra gir | Sayaç ~25:00, hâlâ kadın filtreli match. |
| 4 | 31 dk sonra gir | Otomatik Herkes, sayaç yok, random match. |
| 5 | Süre bitimine yakın ekranda bekle | Biter bitmez otomatik Herkes’e döner, sayaç kaybolur. |

---

## 4. iOS’a yüklemeden önce – Servis checklist

### A) Build almadan kontrol (0 maliyet)

| Kontrol | Bu feature için |
|---------|------------------|
| ENV değişti mi? (.env, EAS secrets) | Hayır. |
| Backend endpoint/contract değişti mi? | Hayır. Match zaten `filterGender` + `filterGenderExpiresAt` kullanıyor; ek parametre yok. |
| Clock (client vs server) | `expiresAt` server’dan geliyor (PUT /api/user/me yanıtı, GET /api/auth/me). Client sadece `Date.now() < expiresAt` ile karar veriyor; server da matchmaking’te aynı mantıkla `effectiveFilterGender` hesaplıyor. |

### B) TestFlight build öncesi tek liste

| Kontrol | Yap |
|---------|-----|
| iOS version/build number | app.config.js `ios.buildNumber` artırıldı mı? App Store Connect ile uyumlu mu? |
| Crash/console | Sentry vb. varsa aktif; yoksa TestFlight + console log ile doğrula. |
| Render deploy | Bu değişiklikte backend kodu yok; migration yok. |
| Twilio / Agora / Cloudinary | Bu değişiklik voice/video/medya ile ilgili değil; dokunulmaz. |

### C) Dikkat edilmesi gereken 2 şey

| # | Ne | Durum |
|---|----|--------|
| 1 | Match filtresi backend’de doğru mu? | Evet. `server/src/socket/matchmaking.ts`: `effectiveFilterGender = (MALE|FEMALE) && genderExpiresAt && new Date(genderExpiresAt) > new Date() ? rawGender : 'BOTH'`. Client “female”/“male” göndermiyor; server DB’den okuyor, süre kontrolü server’da. |
| 2 | Süre bitince backend state | GET /api/auth/me süre dolmuşsa kullanıcıyı BOTH yapıp döndürüyor. Match queue’ya girerken `effectiveFilterGender` zaten süre dolmuşsa BOTH. UI’da da mergeUserFromApi(BOTH) + refreshProfile ile senkron. |

---

## 5. Debug overlay (TestFlight’ta 1 build ile doğrulama)

- **Şu an:** Sadece `__DEV__` iken gösteriliyor; production EAS build’de görünmez.
- **İstersen:** Tek build ile TestFlight’ta da görmek için `__DEV__` koşulunu kaldır veya `SHOW_GENDER_DEBUG=true` gibi bir flag ile aç; doğruladıktan sonra kaldır.

Overlay metni: `active=true|false expiresAt=HH:mm:ss remaining=XXXs`

---

## 6. Özet

- **Değişen:** Sadece `mobile/src/screens/Home/HomeScreen.tsx` (isActive/remaining tek kaynak, açılışta anında reset, UI isActive, debug overlay).
- **Backend:** Değişiklik yok; match ve auth zaten süreye göre BOTH uyguluyor.
- **Servisler:** Bu feature için ek ENV/backend/servis ayarı gerekmiyor; TestFlight öncesi version/build ve (varsa) Sentry kontrolü yeterli.
