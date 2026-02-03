# CardMatch 1.0.8 – Sistem Haritası ve “Güncellemeler Neden Yansımıyor?” Rehberi

Bu doküman: (1) uygulamanın nasıl çalıştığını, nelere bağlı olduğunu, (2) build’in nereden nereye gittiğini, (3) güncellemelerin yansımamasının olası nedenlerini ve her birini nasıl doğrulayacağını tek yerde toplar.

---

## 1. Proje Yapısı (1.0.8)

```
cardmatch/
├── mobile/          ← React Native (Expo) uygulama – Build 1.0.8 burada
│   ├── app.config.js   ← Ana config (version, buildNumber, extra.apiUrl, iapProductIds)
│   ├── app.json        ← buildNumber burada da 1.0.8 ile senkron
│   ├── eas.json        ← EAS Build profilleri; production’da API_URL, SOCKET_URL
│   ├── .env            ← Lokal geliştirme (GIT’E GİTMEZ, EAS’a yüklenmez)
│   ├── index.js        → App.tsx
│   └── src/
│       ├── context/    ← AuthContext, IAPContext, SocketContext, ChatContext
│       ├── services/   ← api.ts (baseURL = Constants.expoConfig.extra.apiUrl)
│       ├── constants/  ← iapProducts.ts (Constants.expoConfig.extra.iapProductIds)
│       └── screens/    ← Home, Chat, FriendChat, Profile, …
├── server/          ← Node/Express backend (Render’da)
└── admin/           ← Next.js admin panel
```

---

## 2. Uygulama Açılışı: Ne Nereden Okunuyor?

| Kaynak | Ne zaman okunur? | Nereden gelir? |
|--------|-------------------|----------------|
| **apiUrl / socketUrl** | Build sırasında `app.config.js` içine yazılır → runtime’da `Constants.expoConfig.extra` | EAS production build: **eas.json** `env.API_URL` / `SOCKET_URL`. Lokal: **.env** |
| **IAP product ID’leri** | Build sırasında `app.config.js` → `extra.iapProductIds` | **app.config.js** (process.env.EXPO_PUBLIC_IAP_* veya varsayılan) |
| **version / buildNumber** | Build sırasında `app.config.js` → native bundle + `Constants.expoConfig` | **app.config.js** (ios.buildNumber: 1.0.8, version: 0.1.0) |
| **Kullanıcı / token** | Runtime | API `/api/auth/me`, SecureStore |

Önemli: **.env dosyası EAS’a yüklenmez** (gitignore’da). Production build’de sadece **eas.json** içindeki `env` (API_URL, SOCKET_URL) ve isteğe bağlı **EAS Secrets** kullanılır.

---

## 3. Build Akışı: Kod → TestFlight → Cihaz

```
[Senin makinen / veya GitHub]
        │
        ▼
  eas build --platform ios --profile production
        │
        ├─ Kaynak: Komut yerel çalıştırılıyorsa → EAS, proje klasörünü YÜKLER (.gitignore’a uyar, .env yok)
        ├─ Kaynak: Build “GitHub’dan tetikleniyorsa” (webhook) → EAS, ilgili commit’i clone eder
        │
        ▼
  EAS sunucuda: npm install, app.config.js çalışır (process.env = eas.json env + EAS Secrets)
        │
        ▼
  Native build (Xcode) + JS bundle (Metro) → .ipa
        │
        ▼
  eas submit veya manuel → App Store Connect → TestFlight
        │
        ▼
  Kullanıcı TestFlight’tan yükler → Cihazda “Build 1.0.8” = o build anındaki kod
```

- **Yerel `eas build`:** Yüklenen kaynak = o anki **yerel klasör** (takip edilen dosyalardaki değişiklikler dahil; .env hariç).
- **GitHub ile build:** Yüklenen kaynak = **tetiklenen commit** (genelde push ettiğin branch/commit). O commit’te olmayan değişiklikler build’e girmez.

---

## 4. 1.0.8’de Olması Beklenen Davranışlar (Kod Tarafı)

Aşağıdakiler **mevcut repodaki kodla** uyumlu; yani “doğru build” bu davranışları gösterir.

| Özellik | Beklenen | Nerede / Nasıl |
|---------|----------|------------------|
| **Profil sürüm** | Profil sekmesi en altta “Sürüm 0.1.0 (Build 1.0.8)” | ProfileScreen.tsx – Constants.expoConfig |
| **IAP (Elmas)** | Home, FriendChat, Chat: gerçek IAP (onay diyaloğu → App Store) | useIAPContext(), purchaseItem(), DIAMOND_AMOUNT_TO_PRODUCT_ID |
| **Mock satın alma** | Chat’te **yok**; `tokens:mock_purchase` soket event’i mobilde kaldırıldı | ChatScreen: handleQuickPurchase → purchaseItem + API |
| **Cinsiyet filtresi** | Kadın/Erkek: 30 dk geri sayım (M:SS), süre bitince Herkes | HomeScreen: filterGenderExpiresAt, mergeUserFromApi, refreshProfile |
| **Profil fotoğrafı** | FormData ile yükleme; Content-Type header’ı kaldırılıyor (boundary için) | api.ts interceptor; user.ts uploadProfilePhoto |
| **API adresi** | Production build’de https://cardmatchapp.onrender.com | eas.json production env |

Sunucu tarafı (kısa):

- **auth.ts** GET `/api/auth/me`: filterGender süresi dolmuşsa DB’de BOTH yapıp döner.
- **user.ts**: filterGender güncelleme, süre (filterGenderExpiresAt), profil fotoğrafı upload (multer) tanımlı.
- **features.ts**: MOCK_PURCHASE_ENABLED: true (sunucu hâlâ mock’u kabul eder; mobilde artık gönderilmiyor).

---

## 5. “Güncellemeler Yansımıyor” – Olası Nedenler ve Kontroller

### A) Cihazda eski build çalışıyor

- **Belirti:** TestFlight’ta 1.0.8 görünüyor ama davranış eski (ör. Chat’te hâlâ “Yakında” / mock, cinsiyet sayacı yok, profilde sürüm satırı yok).
- **Neden:** Yüklenen .ipa eski bir build; sadece TestFlight’ta “1.0.8” görünmesi, cihazda o build’in gerçekten yüklü olduğu anlamına gelmez.
- **Kontrol:** Profil → en alta kaydır. **“Sürüm 0.1.0 (Build 1.0.8)”** satırı var mı?
  - **Yoksa veya farklı build numarasıysa:** Cihazda o anki build eski. TestFlight’tan **1.0.8** build’ini açıkça **Install** et, uygulamayı tamamen kapatıp aç.

### B) Build, güncel koddan alınmamış

- **Belirti:** Profil’de “Build 1.0.8” yazıyor ama IAP/cinsiyet/profil fotoğrafı hâlâ eski.
- **Neden:** 1.0.8 numarası `app.config.js`’te artırıldı ama build, **o değişikliklerin olmadığı bir kaynaktan** alındı (farklı commit, farklı branch, veya cache).
- **Kontrol:**
  - Build’i **yerel** mi alıyorsun? O zaman build aldığın anda `mobile/` altındaki ilgili ekranlar (HomeScreen, ChatScreen, FriendChatScreen, ProfileScreen, api.ts) güncel mi, bir kez `git status` / dosya tarihi ile kontrol et.
  - Build **GitHub ile** tetikleniyorsa: 1.0.8 build’inin hangi **commit**’ten alındığını EAS’ta gör; o commit’te bu dosyaların güncel hali var mı?

### C) EAS cache (eski JS bundle)

- **Belirti:** Native tarafta build 1.0.8 ama davranış eski; bazen “ilk build’den sonra düzeldi” denir.
- **Neden:** EAS önceki build’den JS/native cache kullanmış olabilir.
- **Kontrol:** Bir kez cache’siz build al:  
  `eas build --platform ios --profile production --clear-cache`  
  Bu build’i submit edip TestFlight’tan yükle; aynı davranış devam ediyor mu bak.

### D) Yanlış branch / commit

- **Belirti:** Kodda değişiklik var ama build’e hiç girmemiş.
- **Neden:** Build, senin güncel çalıştığın branch/commit’ten değil, başka bir yerden alınıyor (örn. main eski kalmış, sen feature branch’te çalışıyorsun).
- **Kontrol:** Build’i hangi branch/commit’ten aldığını yaz; o commit’te `mobile/src/screens/...` ve `mobile/src/services/api.ts` için `git log -1 --oneline -- <dosya>` ile son değişiklikleri doğrula.

### E) Sunucu güncel değil (backend)

- **Belirti:** Profil fotoğrafı, cinsiyet süresi vb. API’den dönmüyor / güncellenmiyor.
- **Neden:** Render’daki backend eski commit’te; auth.ts / user.ts değişiklikleri deploy edilmemiş.
- **Kontrol:** Render dashboard’da son deploy’un hangi commit olduğunu kontrol et; `master` (veya kullandığın branch) güncel mi?

### F) İki farklı proje / klasör

- **Belirti:** Kodda her şey doğru ama build hep eski.
- **Neden:** Build’i bir clone’dan, geliştirmeyi başka bir clone’dan yapıyorsun; veya farklı bir repo.
- **Kontrol:** `eas build` çalıştırdığın dizin ile Cursor/IDE’de açtığın `cardmatch` aynı mı? `pwd` ve proje kökü aynı mı?

---

## 6. Tek Seferlik Doğrulama Planı (1.0.8)

1. **Sürümü sabitle**  
   `app.config.js`: version `0.1.0`, ios.buildNumber `1.0.8`. Commit + push (eğer build GitHub’dan alınıyorsa).

2. **Tek kaynaktan build al**  
   - Ya hep yerel: `cd mobile && eas build --platform ios --profile production --clear-cache`  
   - Ya hep GitHub: push → EAS’ta tetiklenen build’i kullan. İkisini karıştırma.

3. **Build’i kimliklendir**  
   EAS’ta build tamamlanınca hangi commit / branch’ten alındığını not et. O commit’te özellikle şunlar var mı bak:  
   - ProfileScreen’de sürüm satırı  
   - ChatScreen’de `purchaseItem` / `handleQuickPurchase` (mock_purchase yok)  
   - HomeScreen’de filterGender sayacı, mergeUserFromApi

4. **Submit + TestFlight**  
   Bu tek build’i submit et; TestFlight’ta sadece bu build’i yükle (önceki 1.0.8’leri kullanma).

5. **Cihazda doğrula**  
   - Profil → “Sürüm 0.1.0 (Build 1.0.8)” görünüyor mu?  
   - Elmas: Chat veya FriendChat’te “Elmas Satın Al” → onay → mağaza açılıyor mu?  
   - Cinsiyet: Kadın/Erkek seçince geri sayım (M:SS) çıkıyor mu?

Bu adımlar tamamsa ve hâlâ “yansımıyor” dersen, sorun büyük ihtimalle **o build’in gerçekten yüklenmemesi** veya **farklı bir build’in açılması**dır; profil sürüm satırı bunu ayırt etmek için kritik.

---

## 7. Kısa Bağımlılık Özeti

- **Uygulama açılışı:**  
  `index.js` → `App.tsx` → AuthProvider, IAPProvider, SocketProvider, ChatProvider → RootNavigator.  
  API baseURL ve IAP ID’leri build anında `Constants.expoConfig.extra` içine gömülü.

- **IAP:**  
  IAPContext → IAPProviderReal (expo-iap). Product ID’ler `iapProducts.ts` ← `app.config.js` ← build-time env.  
  Elmas satın alma sonrası balance: `updateTokenBalance` / `mergeUserFromApi` + gerekiyorsa `refreshProfile`.

- **Cinsiyet filtresi:**  
  HomeScreen: `user.filterGender`, `user.filterGenderExpiresAt`; süre bitince `mergeUserFromApi({ filterGender: 'BOTH', filterGenderExpiresAt: null })` + `refreshProfile`.  
  Backend: GET `/api/auth/me` ve user update’te süre kontrolü.

- **Profil fotoğrafı:**  
  FormData; api interceptor’da FormData ise `Content-Type` siliniyor. Sunucu: user.ts’teki profile-photo multer.

Bu doküman 1.0.8 koduna göre güncellenmiştir; yeni bir sürümde `app.config.js` ve ilgili ekranları güncelleyip bu adımları tekrarlayabilirsin.
