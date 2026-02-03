# CardMatch – IAP ve Abonelik Uçtan Uca Denetim Raporu

**Tarih:** Rapor oluşturulma tarihi  
**Kapsam:** In-App Purchase (Elmas, Boost) ve Prime abonelik akışı  
**Sonuç:** EVET/HAYIR maddeler + nihai karar

---

## 1. ÖNEMLİ BULGU: ÖDEME ALTYAPISI

| Soru | Cevap | Açıklama |
|------|--------|----------|
| Uygulama RevenueCat SDK kullanıyor mu? | **HAYIR** | Mobil tarafta **expo-iap** (StoreKit / Google Play Billing) kullanılıyor. RevenueCat SDK hiç çağrılmıyor. |
| Backend RevenueCat webhook kullanıyor mu? | **HAYIR** | Sunucuda webhook endpoint yok. Hiçbir route RevenueCat webhook’u dinlemiyor. |
| Production API key (RevenueCat) kullanılıyor mu? | **N/A** | RevenueCat akışta kullanılmadığı için key kullanımı yok. `REVENUECAT_PUBLIC_KEY` app.config’de tanımlı ama purchase flow’da kullanılmıyor. |
| Sandbox / test kullanıcı karışıklığı var mı? | **Belirtilmeli** | TestFlight / Sandbox’ta ödeme gerçek para çekmez; production’da gerçek para çekilir. Kodda sandbox/production ayrımı yok. |

**Özet:** Proje dokümanında “RevenueCat” geçse de **gerçek ödeme akışı expo-iap + backend API/socket** ile yürüyor. RevenueCat paneli veya webhook’lar bu akışta **kullanılmıyor**.

---

## 2. KULLANICI GERÇEK APP STORE / GOOGLE PLAY EKRANINA GİDİYOR MU?

| Soru | Cevap |
|------|--------|
| Elmas satın almada Apple/Google ödeme ekranı açılıyor mu? | **EVET** – `expo-iap` `requestPurchase` ile StoreKit / Play Billing ekranı açılıyor. |
| Boost satın almada Apple/Google ödeme ekranı açılıyor mu? | **EVET** – Aynı mekanizma. |
| Prime abonelikte Apple/Google abonelik ekranı açılıyor mu? | **EVET** – `purchaseItem(productId, { type: 'subs' })` ile abonelik ekranı açılıyor. |
| Sandbox / fake ekran mı? | **HAYIR** – Aynı kod; ortam TestFlight/Sandbox ise sandbox, production build ise production ödeme. “Fake” ayrı bir ekran yok. |

**Sonuç:** Ödeme sırasında kullanıcı **gerçek App Store / Google Play (veya sandbox) ödeme ekranına** gidiyor. Production build’de bu **production** ödeme akışıdır.

---

## 3. BOOST / ELMAS KONTROL LİSTESİ

### 3.1 Elmas (Tokens)

| Madde | Durum | Not |
|-------|--------|-----|
| Mobil: Gerçek IAP tetikleniyor (expo-iap) | ✅ | `purchaseItem(DIAMOND_*_PRODUCT_ID)` |
| Mobil: Ödeme sonrası backend’e istek atılıyor | ✅ | `POST /api/user/purchase-tokens` { amount, transactionId } |
| Backend: Receipt / transaction doğrulaması yapılıyor | ❌ | `user.ts` sadece `amount` alıyor; receipt/transactionId **doğrulanmıyor**. Yorum: “simülasyon”. |
| Backend: Aynı transaction iki kez kabul edilmiyor mu? | ❌ | `transactionId` backend’de kullanılmıyor; duplicate kontrolü **yok**. |
| Backend: Bakiye artırılıyor mu? | ✅ | `tokenBalance: { increment: amount }` |
| Mobil: API cevabında newBalance kullanılıyor mu? | ✅ | `res.data.data.newBalance` → `updateTokenBalance` (FriendChat) veya Alert sonrası refresh (Home) |
| Mobil: finishTransaction çağrılıyor mu? | ✅ | Backend başarılı olunca `finishTransaction(purchase, true)` |

**Elmas kısa cevap:** Ödeme ekranı **gerçek**, bakiye **artıyor**, ancak backend **receipt/transaction doğrulaması yapmıyor** ve **duplicate kontrolü yok**. Sahte istek ile bakiye artırılabilir (güvenlik açığı).

### 3.2 Boost

| Madde | Durum | Not |
|-------|--------|-----|
| Mobil: Gerçek IAP tetikleniyor | ✅ | `purchaseItem(IAP_PRODUCT_IDS.BOOST_1H)` |
| Mobil: Ödeme sonrası backend’e istek atılıyor | ✅ | `POST /api/boost/activate` { transactionId, purchaseToken } |
| Backend: Receipt / transaction doğrulaması | ❌ | Kodda TODO; Apple/Google veya RevenueCat doğrulaması **yok**. |
| Backend: Aynı transaction iki kez kabul edilmiyor mu? | ✅ | `transactionId` ile `BoostPurchase` duplicate kontrolü var. |
| Backend: Boost aktif ediliyor mu? | ✅ | `isBoostActive`, `boostExpiresAt` güncelleniyor. |
| Mobil: Başarı sonrası UI güncelleniyor mu? | ✅ | `loadStatus()`, `refreshProfile()`, modal kapanıyor. |

**Boost kısa cevap:** Ödeme **gerçek**, boost **aktif oluyor** ve **duplicate engelli**, ancak backend **receipt doğrulaması yapmıyor**. Doğrulanmamış transactionId ile çağrı yapılabilir (risk).

---

## 4. PRIME ABONELİK KONTROL LİSTESİ

| Madde | Durum | Not |
|-------|--------|-----|
| Mobil: Gerçek abonelik IAP tetikleniyor | ✅ | `purchaseItem(productId, { type: 'subs' })` |
| Mobil: Ödeme sonrası backend’e bildirim | ✅ | `socket.emit('prime:purchase', { userId, packageId, transactionId })` |
| Backend: Receipt / abonelik doğrulaması | ❌ | Socket handler sadece `userId`, `packageId` kullanıyor; `transactionId` kullanılmıyor, doğrulama **yok**. Yorum: “mock”. |
| Backend: isPrime / primeExpiry güncelleniyor mu? | ✅ | `isPrime: true`, `primeExpiry` (weekly/monthly/yearly) set ediliyor. |
| Backend: prime:updated socket ile client’a iletiyor mu? | ✅ | `io.to(userId).emit('prime:updated', { isPrime, primeExpiry })` |
| Mobil: prime:updated dinleniyor mu? | ✅ | AuthContext `socket.on('prime:updated', handlePrimeUpdated)` |
| Mobil: UI (isPrime, kilitler) güncelleniyor mu? | ✅ | AuthContext state güncelleniyor; Home, MatchSettings vb. `user?.isPrime` kullanıyor. |

**Prime kısa cevap:** Abonelik ekranı **gerçek**, Prime **aktif oluyor** ve socket ile UI **senkron**, ancak backend **abonelik/receipt doğrulaması yapmıyor**. Sahte socket event ile Prime açılabilir (güvenlik açığı).

---

## 5. AKIŞ DOĞRULAMASI

### Beklenen (RevenueCat) akış (projede tanımlı değil)

```
Satın Alma → RevenueCat SDK → Webhook → Backend entitlement → UI
```

### Mevcut gerçek akış

```
Satın Alma (expo-iap) → App Store / Play
  → onPurchaseSuccess
  → Backend API/socket (receipt DOĞRULANMIYOR)
  → DB güncelleme (bakiye / boost / Prime)
  → API response veya socket (prime:updated)
  → Mobil UI güncelleme
```

| Adım | Elmas | Boost | Prime |
|------|--------|--------|--------|
| 1. Gerçek ödeme ekranı | ✅ | ✅ | ✅ |
| 2. RevenueCat | ❌ Kullanılmıyor | ❌ | ❌ |
| 3. Webhook | ❌ Yok | ❌ | ❌ |
| 4. Backend receipt/transaction doğrulama | ❌ | ❌ | ❌ |
| 5. Backend DB güncelleme | ✅ | ✅ | ✅ |
| 6. Client’a cevap / event | ✅ (API) | ✅ (API) | ✅ (socket) |
| 7. UI güncelleme | ✅ | ✅ | ✅ |

---

## 6. “ÖDEME SONRASI BAKİYE / ABONELİK %100 YANSIYOR MU?”

**Cevap: EVET (dürüst kullanıcı akışında)**  
- Elmas: Backend bakiye artırıyor, API `newBalance` dönüyor, mobil bakiye/refresh ile yansıyor.  
- Boost: Backend boost’u aktif ediyor, mobil `loadStatus` / `refreshProfile` ile yansıyor.  
- Prime: Backend `isPrime`/`primeExpiry` güncelliyor, `prime:updated` ile AuthContext ve UI güncelleniyor.

**Ancak:**  
**“Hayır, tam güvenilir production sayılmaz”** – çünkü:

1. **Backend hiçbir yerde receipt/transaction doğrulaması yapmıyor.**  
   - Elmas: `POST /api/user/purchase-tokens` sadece `amount` ile bakiye artırıyor.  
   - Boost: `transactionId` duplicate’e karşı kullanılıyor ama Apple/Google ile doğrulanmıyor.  
   - Prime: Socket’e gelen `prime:purchase` doğrulanmıyor.

2. **Nerede kopuyor / ne eksik:**  
   - **Kopma yok** (akış çalışıyor), **eksik olan güvenlik:** Server-side receipt/transaction validation yok.  
   - RevenueCat kullanılmıyor; `subscription.ts` (POST /api/subscription/validate) ve `tokens.ts` (POST /api/tokens/purchase) receipt ile doğrulama içeriyor ama **mobil bu endpoint’leri çağırmıyor**; Elmas için `user.purchase-tokens`, Prime için socket kullanılıyor.

3. **Risk özeti:**  
   - **Webhook gecikmesi:** N/A (webhook yok).  
   - **Cache / state:** Olası geçici tutarsızlık; `refreshProfile` / socket ile genelde toparlanıyor.  
   - **Race condition:** Tek transaction için duplicate kontrolü sadece Boost’ta var; Elmas’ta yok.  
   - **Optimistic UI:** Başarılı API/socket sonrası güncelleme yapılıyor; yanlış optimistic “success” senaryosu taranmadı, ancak mevcut kodda kritik bir yanlış optimistic path görünmüyor.  
   - **En büyük risk:** Sahte veya manipüle edilmiş isteklerle bakiye/Prime/Boost verilebilir (server doğrulama olmadığı için).

---

## 7. MİNİMAL VE GÜVENLİ İYİLEŞTİRME ÖNERİLERİ

1. **Elmas – Backend (`user.ts`):**  
   - `transactionId` (ve mümkünse receipt) al; aynı `transactionId` ile ikinci isteği reddet.  
   - İleride: Apple/Google receipt validation veya RevenueCat webhook ile doğrulama ekle.

2. **Boost – Backend (`boost.ts`):**  
   - Mevcut duplicate kontrolü kalmalı.  
   - Production için: Apple verifyReceipt / Google Purchase API veya RevenueCat ile transaction doğrulama ekle (TODO’lar buna işaret ediyor).

3. **Prime – Backend (socket veya API):**  
   - `prime:purchase` payload’ında gelen `transactionId`/receipt’i kullan; en azından aynı transactionId ile tekrar Prime verme.  
   - İleride: Abonelik durumunu Apple/Google veya RevenueCat ile doğrula.

4. **RevenueCat kullanılacaksa:**  
   - Mobil: RevenueCat SDK entegrasyonu + mevcut expo-iap yerine veya onunla uyumlu tek bir strateji.  
   - Backend: RevenueCat webhook endpoint’i ekle; webhook’tan gelen event’lere göre bakiye/Boost/Prime güncelle.  
   - Bu yapılmadan “RevenueCat panel ayarları” ve “entitlement eşleşmeleri” mevcut akışı etkilemiyor.

---

## 8. MANUEL TEST ADIMLARI (GERÇEK CİHAZ)

1. **TestFlight (iOS) veya internal test (Android)** ile kurulum.  
2. **Sandbox hesabı** ile giriş (gerçek para çekilmez).  
3. **Elmas:** Ana sayfa → Elmas satın al → Paket seç → Apple/Google ödeme ekranı açılmalı → Tamamla → Bakiye artmalı, ekranda doğru görünmeli.  
4. **Boost:** Ana sayfa → Boost → Satın al → Ödeme ekranı → Tamamla → Boost aktif, süre sayacı çalışmalı.  
5. **Prime:** Ana sayfa → Prime → Haftalık/Aylık/Yıllık seç → Abonelik ekranı → Tamamla → Eşleşme ayarları kilidi açılmalı, Prime rozeti görünmeli.  
6. Uygulama kapatıp açınca bakiye / Boost / Prime bilgisi korunmalı (backend’den `refreshProfile` ile geliyor).

---

## 9. NİHAİ KARAR

- **Ödeme ekranı:** EVET – Kullanıcı gerçek App Store / Google Play (veya sandbox) ödeme ekranına gidiyor; production build’de production ödeme.  
- **Ödeme sonrası bakiye / abonelik yansıması:** EVET – Dürüst kullanıcı akışında bakiye artıyor, Boost aktif oluyor, Prime aktif oluyor ve UI güncelleniyor.  
- **Production için tam güvenilir mi?** HAYIR – Backend’de receipt/transaction doğrulaması olmadığı için **kısmen güvenlik açığı var**; sahte isteklerle bakiye/Boost/Prime verilebilir.  

**Cümleyle:**  
**“Evet, ödeme gerçek ve (dürüst kullanıcıda) anında yansıyor; ancak backend doğrulama olmadığı için production’da hâlâ kısmen ‘güvene dayalı’ ve eksik. RevenueCat kullanılmıyor; mevcut akış expo-iap + backend API/socket ile çalışıyor.”**
