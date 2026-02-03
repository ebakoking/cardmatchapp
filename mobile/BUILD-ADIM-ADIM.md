# Build Alma – Adım Adım (Kopyala-Yapıştır)

**Nereden yapılır:** Bilgisayarında **terminal** (Cursor içindeki Terminal veya Mac’teki Terminal.app – ikisi de aynı).

**Cursor’da Terminal açmak:** Menüden **View → Terminal** veya kısayol **Ctrl+`** (Mac’te **Cmd+`**).

---

## Adım 1: Proje klasörüne gir

Terminalde şunu yaz (proje kökün `cardmatch` ise):

```bash
cd ~/cardmatch
```

Veya projen tam yolunu biliyorsan:

```bash
cd /Users/ergunberkatikkurt/cardmatch
```

Enter’a bas. Bir sonraki komutlar bu proje içinde çalışacak.

---

## Adım 2: Sunucu migration (sadece bir kez / yeni alanlar varsa)

Eğer `filterGenderExpiresAt` için migration’ı hiç çalıştırmadıysan:

```bash
cd server
npx prisma migrate dev --name add_filter_gender_expires_at
cd ..
```

Eğer “No pending migrations” veya migration zaten uygulandı derse bu adımı atlayabilirsin. Sonra yine proje kökündesin (`cardmatch`).

---

## Adım 3: Mobil build numarası

Build numarası **1.0.2** olacak şekilde ayarlandı (`mobile/app.config.js`). Başka bir numara istersen dosyayı kendin değiştirirsin. Bu adımda komut yok, sadece bilgi.

---

## Adım 4: Mobil klasörüne gir

```bash
cd mobile
```

Bundan sonraki komutlar `mobile` içinde çalışacak.

---

## Adım 5: EAS build (iOS) başlat

```bash
eas build --platform ios --profile production
```

Enter’a bas.

- İlk seferde **Expo hesabına giriş** isteyebilir; e-postanı ve şifreni yaz.
- **Apple Developer** bilgisi istenirse (bundle id, provisioning) EAS kendi halleder; sorulursa onay ver.
- Build **Expo sunucularında** çalışır; terminalde “Build started” / link görürsün. Bir süre (yaklaşık 10–20 dakika) bekleyeceksin.

Build durumunu takip etmek için: tarayıcıda **https://expo.dev** → giriş yap → projeni seç → **Builds**. Orada “in progress” / “finished” görürsün.

---

## Adım 6: Build bitince TestFlight’a gönder

Build **finished** olduktan sonra (Expo sayfasında yeşil tik), terminalde yine `mobile` klasöründeyken:

```bash
eas submit --platform ios --latest
```

Enter’a bas.

- **Son build** otomatik seçilir.
- Apple ID / App Store Connect ile ilgili sorular çıkarsa doldur; **latest** dediğin için hangi build’in gideceği belli olur.
- Submit bitince “Submitted to App Store Connect” benzeri bir mesaj görürsün.

---

## Adım 7: TestFlight’tan yükle

1. Birkaç dakika bekle; Apple işlesin (e-posta da gelebilir).
2. **iPhone’da** App Store’dan **TestFlight** uygulamasını aç (yoksa indir).
3. TestFlight’ta **CardMatch**’i bul → **Yükle** veya **Güncelle**.
4. Uygulamayı TestFlight’tan açıp test et.

---

## Kopyala-yapıştır özet (sırayla)

```bash
cd /Users/ergunberkatikkurt/cardmatch
cd server && npx prisma migrate dev --name add_filter_gender_expires_at && cd ..
cd mobile
eas build --platform ios --profile production
```

Build bittikten sonra:

```bash
cd /Users/ergunberkatikkurt/cardmatch/mobile
eas submit --platform ios --latest
```

---

## Notlar

- **Terminal nerede açılır?** Cursor’da **View → Terminal** veya **Cmd+`**; istersen Mac’te **Terminal.app** de kullanabilirsin, komutlar aynı.
- **EAS CLI yoksa:** `npm install -g eas-cli` (bir kez).
- **Build süresi:** Genelde 10–20 dakika; Expo sayfasından takip et.
- **Submit:** Sadece build **finished** olduktan sonra çalıştır.

Bu adımları takip edersen build’i terminalden alıp TestFlight’a kadar getirmiş olursun.
