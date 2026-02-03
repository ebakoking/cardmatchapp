# Kural: Kanıt Önce, Kod Sonra + Ödeme/Kritik Akış Haritası

---

## ZORUNLU KURAL (Kod yazmadan önce)

1. **Repro adımlarını net yaz** – Hangi ekran, hangi aksiyon, beklenen vs gerçek davranış.
2. **Kök nedeni tek cümleyle belirt** – Tahmin değil, log/state ile desteklenmiş neden.
3. **Console / state kanıtını göster** – Hedef log’lar ile “beklenen vs gerçek” farkı kanıtlanmalı.

**Bu 3 madde yoksa kod yazma.** Önce ilgili ekran/state bulunur, sadece o noktaya hedefli log eklenir, fark kanıtlanır, kök neden yazılır; ancak ondan sonra **sadece o nedene yönelik minimal fix** yapılır.

**Çıktı formatı:**
- Kök neden (1 cümle)
- Değişen dosyalar
- Build almadan nasıl doğrulanacağı

---

## AŞAMA 2 — Ödeme & Kritik Akışlar (Harita; Fix yok)

Ödeme, abonelik, elmas, boost ve timer ile ilgili **hiçbir kod değiştirilmeden** önce mevcut akışın haritası aşağıda. Harita çıkmadan bu akışlarda fix yapılmaz.

---

### 1. Elmas (token) bakiyesi – State nerede, nerede güncelleniyor

| Ne | Nerede | Açıklama |
|----|--------|----------|
| **State** | `AuthContext`: `user.tokenBalance` + `instantBalance` | Tek merkez: `setUserSafe`, `applyBalance`, `updateTokenBalance`, `addTokens`, `deductTokens`, `mergeUserFromApi`. |
| **Backend** | `GET /api/auth/me` | Bakiye buradan gelir; `refreshProfile()` çağrılınca güncellenir (throttle 10 sn). |
| **Backend** | `POST /api/user/purchase-tokens` | Elmas satın alma sonrası bakiye artar; yanıt `newBalance` döner. |
| **Socket** | `token:balance_updated`, `token:spent`, `token:earned`, `gift:sent` | AuthContext bu event’lerde `applyBalance({ tokenBalance: payload.newBalance })` ile bakiye günceller. |
| **UI** | HomeScreen, ProfileScreen, FriendChatScreen, ChatScreen, BoostButton, MatchSettingsScreen | `user.tokenBalance` veya `instantBalance` kullanır; AuthContext’ten `useAuth()`. |

**Elmas satın alma akışı (3 yer):**
- **HomeScreen:** `purchaseItem(productId)` → `api.post('/api/user/purchase-tokens', { amount, transactionId })` → `updateTokenBalance(res.data.data.newBalance)` veya `refreshProfile()`.
- **ChatScreen:** Aynı: `purchaseItem` → `purchase-tokens` → `updateTokenBalance` / `refreshProfile`.
- **FriendChatScreen:** Aynı: `purchaseItem` → `purchase-tokens` → `updateTokenBalance` / `refreshProfile`.

---

### 2. Boost – State nerede, nerede güncelleniyor

| Ne | Nerede | Açıklama |
|----|--------|----------|
| **State** | `BoostButton`: `timeRemaining`, `isActive` (local). HomeScreen: `boostActive`, `boostTimeLeft` | BoostButton kendi state’ini `/api/boost/status` ile doldurur; HomeScreen ayrıca `loadBoostStatus()` ile okur. |
| **Backend** | `GET /api/boost/status` | `isActive`, `remainingSeconds` döner. |
| **Backend** | `POST /api/boost/activate` | Boost satın alındıktan sonra aktivasyon; body’de transactionId vb. |
| **IAP** | `BoostButton`: `purchaseItem(IAP_PRODUCT_IDS.BOOST_1H)` | expo-iap ile satın alma, sonra `api.post('/api/boost/activate', ...)`. |
| **UI** | `BoostButton`, HomeScreen (boost pill / timer) | `timeRemaining` saniye bazlı gösterilir; HomeScreen’de `setInterval` ile her saniye `setBoostTimeLeft(prev => prev - 1)`. |

---

### 3. Cinsiyet filtresi (Kadın/Erkek) + 30 dk sayaç

| Ne | Nerede | Açıklama |
|----|--------|----------|
| **State** | `AuthContext`: `user.filterGender`, `user.filterGenderExpiresAt`. HomeScreen: `genderSecondsLeft` | Sayaç sadece HomeScreen’de; süre bitince `mergeUserFromApi({ filterGender: 'BOTH', filterGenderExpiresAt: null })` + `refreshProfileRef.current()`. |
| **Backend** | `PUT /api/user/me` `{ filterGender: 'FEMALE' | 'MALE' }` | 50 elmas düşer, `filterGenderExpiresAt` = now + 30 dk döner. |
| **Backend** | `PUT /api/user/me` `{ filterGender: 'BOTH' }` | Süre iptal; `filterGenderExpiresAt` null. |
| **Backend** | `GET /api/auth/me` | Süre dolmuşsa backend BOTH yapıp döner (auth route’da kontrol). |
| **UI** | HomeScreen: Kadın/Herkes/Erkek satırı, “Öncelikli eşleştirme • M:SS” | `genderSecondsLeft` her saniye `setInterval` ile güncellenir; dependency `[user?.filterGender, user?.filterGenderExpiresAt]` (refreshProfile ref ile). |

---

### 4. Abonelik (Prime) – State nerede, nerede güncelleniyor

| Ne | Nerede | Açıklama |
|----|--------|----------|
| **State** | `AuthContext`: `user.isPrime`, `user.primeExpiry` | `setUserSafe` / socket / refreshProfile ile güncellenir. |
| **Backend** | `POST /api/subscription/validate` (veya benzeri) | Receipt doğrulama (RevenueCat vb.). |
| **IAP** | HomeScreen (Prime modal): `purchaseItem(..., { type: 'subs' })` | Haftalık/aylık/yıllık abonelik. |
| **UI** | HomeScreen (Prime modal), ProfileScreen, ayar ekranları | `user.isPrime` ile kilit/açık davranış. |

---

### 5. Ortak noktalar (dokunulmadan önce düşünülecek)

- **AuthContext** tüm bakiye ve kullanıcı alanları için tek kaynak; `refreshProfile` throttle’lı (10 sn).
- **Socket** bakiye güncellemelerini anlık yansıtır; `applyBalance` ile `tokenBalance` ve `instantBalance` güncellenir.
- **IAP** akışı her yerde: `purchaseItem` → backend’e receipt/transactionId gönder → `updateTokenBalance` veya `refreshProfile` veya `mergeUserFromApi` ile UI güncelle.

Bu harita, “ödeme / kritik akışlarda bug var” denildiğinde **önce state → backend → UI** zincirini takip etmek ve ancak kanıt (repro + kök neden + log) sonrası minimal fix yapmak için kullanılır.

---

## AŞAMA 3 — TestFlight’ın amacı

TestFlight:

- **“Çalışıyor mu?”** genel testi için değil,
- **“Apple gerçek ortamda (production IAP, sandbox/receipt) aynı mı?”** kontrolü içindir.

Yani davranış önce dev/build ortamında kanıtlanır; TestFlight ile production parity doğrulanır.
