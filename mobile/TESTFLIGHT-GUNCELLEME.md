# iOS Güncellemeyi TestFlight'ta Deneme – Adımlar

## 0. IAP (Uygulama İçi Satın Alma) build'i aldıysan

Bu sürümde **gerçek IAP** (Elmas, Boost, Prime) entegre. Yeni build almak için:

```bash
cd mobile
npm install          # expo-iap dahil bağımlılıkları yükle
eas build --platform ios --profile production
```

Build bittikten sonra **5. adıma** geç (submit).

---

## 1. Yeni build'i TestFlight'a gönder

Terminalde (mobile klasöründeyken):

```bash
eas submit --platform ios --latest
```

Bu komut **en son aldığın build'i** (şu an biten .ipa) Apple App Store Connect'e yükler.  
Bittiğinde "Submitted to App Store Connect" benzeri bir mesaj görürsün.

---

## 2. Apple'ın işlemesini bekle (5–15 dk)

- Apple binary'yi işler; bitince **e-posta** gelir (ebatikkurt@gmail.com).
- İstersen durumu buradan takip edebilirsin:  
  https://appstoreconnect.apple.com/apps/6758614512/testflight/ios

---

## 3. TestFlight'ta build'i gruba ekle (gerekirse)

- App Store Connect → **TestFlight** → **iOS** → **External Testing** → **CardMatch_test_group**
- **Builds** sekmesinde yeni build görünecek (örn. 0.1.0 (1.0.0)).
- Build’in yanında **“+”** veya **“Add Build”** varsa, bu gruba ekle.
- **External Testers** için ilk kez kullanıyorsan Apple incelemesi isteyebilir (bir kez, birkaç saat–1 gün sürebilir).

---

## 4. Test kullanıcıları güncellemeyi nasıl alır?

**Zaten TestFlight’ta olanlar:**
- iPhone’da **TestFlight** uygulamasını açarlar.
- **CardMatch** kartında “Update” / “Güncelle” çıkar; dokunup güncellerler.
- Bazen TestFlight’ı kapatıp açmak veya uygulamayı silip TestFlight’tan tekrar yüklemek gerekebilir.

**Public link ile katılanlar:**
- https://testflight.apple.com/join/2n3qnExQ  
- Bu linke girip TestFlight’tan CardMatch’i yükleyenler de aynı güncellemeyi görür.

---

## 5. IAP'ı TestFlight'ta nasıl test edersin? (Sandbox)

Gerçek para çekilmeden denemek için **Sandbox** kullanılır:

1. **Sandbox Apple ID oluştur:** App Store Connect → Users and Access → Sandbox → Testers → + ile yeni test hesabı. Gerçek kart gerekmez.
2. **iPhone'da:** Ayarlar → App Store → en alta in → Sandbox Hesabı → test Apple ID ile giriş.
3. **TestFlight’tan uygulamayı aç;** satın alma denediğinde "Environment: Sandbox" çıkar, ücret alınmaz.
4. **Dene:** Elmas (ana sayfa / sohbet modalı), Boost (ana sayfa), Prime (ana sayfa modalı).

App Store Connect’te In-App Purchases ürünlerinin (cardmatch_diamond_50, cardmatch_boost_1h, cardmatch_prime_weekly vb.) Ready to Submit olduğundan emin ol.

---

## Kısa özet

| Adım | Ne yapıyorsun |
|------|----------------|
| 0 | IAP build: `npm install` → `eas build --platform ios --profile production` |
| 1 | `cd mobile` → `eas submit --platform ios --latest` |
| 2 | 5–15 dk bekle, Apple e-postası gelsin |
| 3 | App Store Connect → TestFlight → Build’i gruba ekle (gerekirse) |
| 4 | Test kullanıcıları TestFlight’ta “Güncelle” ile yeni sürümü alır |
