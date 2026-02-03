# Build Almak İçin Adımlar (Bu Son Değişiklikler)

Bu dokümanda **son yaptığımız değişikliklerle** build almak için sırayla yapılacaklar listeleniyor.

---

## 1. Sunucu (server)

### Migration çalıştır

Yeni alanlar için migration alınmamışsa:

```bash
cd server
npx prisma migrate dev --name add_filter_gender_expires_at
```

(Bu migration `filterGenderExpiresAt` alanını ekler. `preferHighSpark` daha önce eklenmiş olabilir; migration zaten varsa sadece `filterGenderExpiresAt` içeren bir migration oluştur.)

### Sunucuyu çalıştır / deploy

- Lokal test: `npm run dev` (veya kullandığın komut)
- Deploy: Render / kullandığın platformda deploy et; migration’lar genelde deploy sırasında veya ayrı bir komutla çalıştırılır.

---

## 2. Mobil: Build numarasını artır

`mobile/app.config.js` içinde iOS için **buildNumber**’ı artır (örn. 1.0.1 → 1.0.2):

```js
ios: {
  // ...
  buildNumber: '1.0.2',  // Her yeni build’de artır
  // ...
},
```

---

## 3. Mobil: API URL kontrolü (Profil fotoğrafı için)

Prime profil fotoğrafının **leaderboard, arkadaş listesi, arkadaş sohbeti, profil sayfası**nda doğru görünmesi için:

- **mobile:** `app.config.js` / `.env` içinde **API base URL** (`extra.apiUrl` veya `API_URL`) doğru olmalı; profil fotoğrafı relative URL ile geliyorsa bu URL ile birleştirilir.
- **server:** Profil fotoğrafı yüklemede **Cloudinary** kullanılıyorsa tam URL döner; kullanılmıyorsa relative path döner. Production’da Cloudinary kullanman önerilir (Render ephemeral disk sorununu önlemek için).

Kontrol:

- `mobile/src/utils/photoUrl.ts` → `getPhotoUrl` → `API_BASE_URL` (Expo extra’dan)
- `app.config.js` → `extra: { apiUrl: process.env.API_URL }` ve `.env` → `API_URL=https://...`

---

## 4. iOS build al

```bash
cd mobile
eas build --platform ios --profile production
```

Build tamamlanana kadar bekle (Expo sayfasında takip edebilirsin).

---

## 5. TestFlight’a gönder

Build bittikten sonra:

```bash
eas submit --platform ios --latest
```

veya expo.dev → proje → Builds → ilgili build → **Submit to App Store Connect**.

---

## 6. TestFlight’tan test et

1. Apple işlesin (birkaç dakika – e-posta gelebilir).
2. Telefonda **TestFlight** uygulamasından **CardMatch**’i yükle / güncelle.
3. Kontrol listesi:
   - **Eşleşme ayarları:** Yaş (18–40+), mesafe, cinsiyet (Kadın 50💎 | Herkes | Erkek 50💎), 30 dk sayaç.
   - **Prime profil fotoğrafı:** Kendi profilinde, leaderboard’da, arkadaş listesinde, arkadaş sohbeti header’da, birinin profiline tıklayınca doğru ve siyah ekran olmadan görünüyor mu?

---

## Kısa checklist

- [ ] Server: `prisma migrate dev` (filterGenderExpiresAt vb.)
- [ ] mobile/app.config.js: `buildNumber` 1.0.2 (veya bir sonraki)
- [ ] API URL / Cloudinary: profil fotoğrafı için kontrol
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios --latest` (veya Expo sayfasından)
- [ ] TestFlight’tan yükle ve Prime profil fotoğrafı + filtreleri test et

Detaylı cihaza kurulum: `EAS-BUILD-CIHAZA-KURMA.md`.
