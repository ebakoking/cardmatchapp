# Build Öncesi Son Kontrol – Kadın/Erkek Filtre (TestFlight Tek Build Doğrulama)

---

## 1. Yapılan minimal diff

### 1.1 expiresAt parse garantisi

- **Helper:** `toMs(expiresAt: string | number | null | undefined): number`
  - **ISO string** → `new Date(expiresAt).getTime()`
  - **number (ms)** → doğrudan kullan
  - null/undefined veya NaN → 0
- **Kullanım:** `expiresAtMs = toMs(user?.filterGenderExpiresAt)`; effect içinde `endMs = toMs(raw)`, `computeSeconds()` bu endMs ile hesaplıyor.

### 1.2 Debug overlay TestFlight’ta görünür

- **app.config.js** `extra`: `showTimerDebugOverlay: process.env.SHOW_TIMER_DEBUG_OVERLAY === 'true'`
- **HomeScreen:** Overlay koşulu: `__DEV__ || (Constants.expoConfig?.extra)?.showTimerDebugOverlay === true`
- **Overlay metni (3 satır):**
  - `active: true/false`
  - `expiresAt: <ms> (ms)`
  - `remaining: <sec>s  nowMs: <ms>`

### 1.3 Match request – effective gender

- **Client tarafı:** "Eşleşme Bul" → `onMatchPress` → `navigation.navigate('MatchQueue')`. MatchQueue’da `socket.emit('match:join', { userId: user.id })` – **sadece userId gidiyor, filter client’tan gönderilmiyor.**
- **Server tarafı:** `match:join` geldiğinde kullanıcı DB’den okunuyor; `effectiveFilterGender` server’da hesaplanıyor: `(MALE|FEMALE) && genderExpiresAt && new Date(genderExpiresAt) > new Date() ? rawGender : 'BOTH'`. Yani **kaynak server DB + expiresAt.**
- **Süre bitince:** UI’da `mergeUserFromApi(BOTH)` + `refreshProfile()`. `refreshProfile()` → GET `/api/auth/me`; auth route süre dolmuşsa DB’yi BOTH yapıp döndürüyor. Sonraki match:join’de server DB’den BOTH okuyor → **karışık eşleşme.**  
- **Sonuç:** Match butonu client’ta filter göndermiyor; server DB + effectiveFilterGender kullanıyor. Süre bitince refreshProfile ile DB BOTH oluyor; "Bittiği an match butonuna basınca gerçekten karışık döner."

---

## 2. EAS env değişkeni (overlay için)

| Ad | Değer | Nereye? |
|----|--------|--------|
| **SHOW_TIMER_DEBUG_OVERLAY** | `true` | EAS Dashboard → Project → Secrets (veya production build için Environment Variables). Tek doğrulama build’inde ekle; sonra kaldır. |

**Alternatif:** `eas.json` → `build.production.env` içine `"SHOW_TIMER_DEBUG_OVERLAY": "true"` ekleyebilirsin (sadece o build için); kalıcı istemiyorsan Secret kullan.

---

## 3. TestFlight doğrulama adımları (5 madde)

1. **Overlay açık build:** EAS’ta `SHOW_TIMER_DEBUG_OVERLAY=true` ile production build al; TestFlight’ta yükle. Ana sayfada cinsiyet satırı altında 3 satırlık overlay görünmeli (active, expiresAt ms, remaining s, nowMs).
2. **App aç → Herkes:** Varsayılan Herkes; overlay’de `active: false`; match karışık.
3. **50 elmas → Kadın:** Sayaç 30:00, overlay `active: true`, `expiresAt` dolu, `remaining` azalıyor; match sadece kadın.
4. **Süre bitince:** Ekranda bekle, sayaç 0’a gelince otomatik Herkes; overlay `active: false`; hemen "Eşleşme Bul" → karışık dönmeli.
5. **31 dk sonra gir:** Uygulamayı kapat, 31 dk sonra aç; ana sayfa Herkes, overlay `active: false`; match karışık.

---

## 4. EAS / TestFlight tarafında yapılacaklar

- **EAS env (overlay):** Secret veya production env’e `SHOW_TIMER_DEBUG_OVERLAY=true` (sadece doğrulama build’i için).
- **Build number:** App Store Connect ile uyumlu artır (app.config.js `ios.buildNumber`).
- **Backend:** Bu feature için deploy yok; Render’da ekstra iş yok.
- **Twilio / Agora / Cloudinary / GitHub:** Bu değişiklik için dokunulmaz.

---

## 5. Değişen dosyalar özeti

| Dosya | Değişiklik |
|-------|------------|
| **mobile/app.config.js** | `extra.showTimerDebugOverlay: process.env.SHOW_TIMER_DEBUG_OVERLAY === 'true'` |
| **mobile/src/screens/Home/HomeScreen.tsx** | `toMs()` helper; `expiresAtMs`/effect’te `toMs` kullanımı; overlay `__DEV__ \|\| showTimerDebugOverlay`; overlay metni active, expiresAt (ms), remaining, nowMs |
