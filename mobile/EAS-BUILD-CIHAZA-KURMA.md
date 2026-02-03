# EAS Build’i Cihaza Kurma

Build bittikten sonra uygulamayı telefona nasıl kuracağını adım adım anlattım.

---

## iOS

### Yol 1: TestFlight ile (production build – en kolay)

1. **Build al (production):**
   ```bash
   cd mobile
   eas build --platform ios --profile production
   ```
2. Build bitince **TestFlight’a gönder:**
   ```bash
   eas submit --platform ios --latest
   ```
   veya build sayfasından **Submit to App Store Connect**.
3. Apple işlesin (5–15 dk), e-posta gelsin.
4. **Telefonda:** App Store’dan **TestFlight** uygulamasını indir (yoksa).
5. TestFlight’ta **CardMatch**’e tıkla → **Yükle** / **Install**.
6. Uygulama cihaza kurulur; TestFlight’tan açarsın.

Bu yöntemde cihaza “linkten kurulum” yapmıyorsun; her şey TestFlight üzerinden.

---

### Yol 2: Build linkinden indirip kurma (preview / internal)

**Not:** Sadece **Apple Developer hesabına kayıtlı cihazlara** kurulur (UDID). Yeni cihaz eklemek için [expo.dev](https://expo.dev) → proje → **Devices** veya Apple Developer → Cihaz ekle.

1. **Build al (preview – internal dağıtım):**
   ```bash
   eas build --platform ios --profile preview
   ```
2. Build bitince **expo.dev**’de build sayfasına gir.
3. **Install** bölümünde **QR kod** veya **link** çıkar.
4. **Aynı Apple ID ile giriş yapılmış iPhone’da** bu linke tıkla (Safari’de aç).
5. “Profil indir” / “Profil yükle” denir → **İzin ver**.
6. **Ayarlar → Genel → VPN ve cihaz yönetimi** → Expo/development profiline **Güven** de.
7. Ana ekranda **CardMatch** ikonu çıkar; tıkla, kurulum biter.

İlk seferde “Güvenilmeyen geliştirici” uyarısı çıkarsa: **Ayarlar → Genel → VPN ve cihaz yönetimi** → ilgili geliştiriciye **Güven** ver.

---

## Android

1. **Build al (production = APK):**
   ```bash
   eas build --platform android --profile production
   ```
2. Build bitince **expo.dev** → build sayfası → **Download** (APK indir).
3. APK’yı **telefona gönder** (e-posta, Google Drive, AirDrop benzeri bir yolla) veya aynı ağda bilgisayardan telefona at.
4. Telefonda **APK dosyasına tıkla**.
5. “Bilinmeyen kaynaklardan yükleme” kapalıysa açman istenir → **İzin ver**.
6. **Yükle** de; kurulum biter.

Linki doğrudan telefonda açıp indirip de kurabilirsin (Chrome vb.).

---

## Kısa özet

| Platform | Build profili      | Cihaza nasıl kurulur?                          |
|----------|--------------------|------------------------------------------------|
| iOS      | production         | TestFlight’a submit et → TestFlight’tan yükle |
| iOS      | preview (internal) | expo.dev’deki link/QR → Safari’de aç → profili yükle → Ayarlar’dan güven ver |
| Android  | production         | APK indir → telefonda APK’ya tıkla → yükle     |

En pratik iOS yolu: **production build** al → **TestFlight’a gönder** → TestFlight uygulamasından **Yükle**.
