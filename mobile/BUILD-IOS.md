# iOS Build Nasıl Alınır (EAS)

**Not:** Önce bu build alınacak (son aldığımız build); IAP backend doğrulama vb. eklemeler **build sonrası** yapılacak. → Bkz. `BUILD-SIRASI-NOT.md`

---

Yaptığın kod değişikliklerini TestFlight veya App Store’a göndermek için yeni bir iOS build alman gerekir.

## Gereksinimler

- Bilgisayarda **EAS CLI** yüklü olmalı
- **Expo hesabına** giriş yapılmış olmalı
- **Apple Developer** hesabı (zaten kullanıyorsun)

---

## Adım 1: EAS CLI yüklü mü kontrol et

Terminalde:

```bash
eas --version
```

Yoksa yükle:

```bash
npm install -g eas-cli
```

---

## Adım 2: Expo’ya giriş yap

```bash
eas login
```

E-posta ve şifrenle giriş yap (Expo hesabın).

---

## Adım 3: Proje klasörüne geç

```bash
cd mobile
```

*(Zaten `mobile` içindeysen bu adımı atla.)*

---

## Adım 4: iOS build başlat

**TestFlight / App Store için (production):**

```bash
eas build --platform ios --profile production
```

Bu komut:

1. Kodunu Expo sunucularına gönderir
2. Apple için bir **.ipa** dosyası oluşturur
3. Build bittiğinde sana link verir (indirip bilgisayara alabilirsin)

Build süresi genelde **10–25 dakika**. Terminal’de link çıkacak; tarayıcıdan takip edebilirsin.

---

## Adım 5: Build’i TestFlight’a gönder (isteğe bağlı)

Build tamamlandıktan sonra **otomatik göndermek** istersen:

```bash
eas build --platform ios --profile production --auto-submit
```

Bu, build bittikten sonra build’i **App Store Connect**’e (TestFlight’a) yükler.

**Elle göndermek** istersen:

1. [expo.dev](https://expo.dev) → Projen → **Builds** → iOS build’e tıkla
2. **Submit to App Store Connect** veya **Download** ile .ipa’yı indir
3. Apple’ın **Transporter** uygulaması veya `eas submit` ile yükle:

```bash
eas submit --platform ios --latest
```

---

## Kısa özet

| Ne yapıyorsun?        | Komut |
|----------------------|--------|
| Yeni iOS build al    | `cd mobile` sonra `eas build --platform ios --profile production` |
| Build + TestFlight’a gönder | `eas build --platform ios --profile production --auto-submit` |
| Sadece son build’i gönder   | `eas submit --platform ios --latest` |

Build linki çıktığında tarayıcıdan **Build details** sayfasında ilerlemeyi izleyebilirsin.
