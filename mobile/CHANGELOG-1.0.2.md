# 1.0.1'den Farklı Yapılanlar (Takip)

Bu dosya, **TestFlight’taki 1.0.1** sürümünden sonra yapılan değişiklikleri listeler.  
Merge / build öncesi "1.0.1’de ne vardı, şimdi ne eklendi?" diye buradan takip edebilirsin.

---

## 1.0.1’de Olanlar (Referans)

| Özellik | Açıklama |
|--------|----------|
| Eşleştirme ayarları crash düzeltmesi | Slider kaldırıldı, mesafe **butonlarla** (5, 10, 20, 40, 80, 160 km). |
| Konum izni tek sefer | App açılışta konum istemiyor; sadece **ProfileSetup** ekranında 1 kere, önce mevcut izin kontrol ediliyor. |
| Profil / avatar fotoğraf | Sunucuda profil fotoğrafı için **Cloudinary**; istemcide **resizeMode="cover"** ve basit placeholder. |
| Build numarası | iOS **1.0.1**. |

---

## 1.0.2 (veya sonraki) İçin Eklenen / Değişenler

### Eşleştirme Ayarları (MatchSettingsScreen)

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| Mesafe **custom slider** | `MatchSettingsScreen.tsx` | Native Slider yok; **View + PanResponder** ile 5–160 km, 5 km adım. Expo Go ve iOS’ta crash olmaz. |
| Yaş **custom slider** | `MatchSettingsScreen.tsx` | Min yaş ve max yaş için **18–40+** (maks 40 = "40+"), 1’er yıl adımlı iki custom slider (View + PanResponder). |
| Tasarım (tema renkleri) | `MatchSettingsScreen.tsx` | Altın/sarı kaldırıldı; seçili öğeler **accent** / **surfaceLight**; mesafe/yaş değeri **accent** ile gösteriliyor. |
| **En yüksek sparklı eşleş** (Prime) | `MatchSettingsScreen.tsx` | Aç/kapa toggle; açıksa eşleşme kuyruğunda öncelik en yüksek spark’a sahip kişilere verilir. Backend: `preferHighSpark` alanı + matchmaking’de adaylar spark’a göre sıralanır. |

### Uygulama Kökü (App.tsx)

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| **iOS formatına dönüş** | `App.tsx` | AppRoot sınıfı ve **requestAnimationFrame** kaldırıldı. Sadece fonksiyon bileşeni: **useEffect** ile bildirim izni, **SafeAreaProvider** + provider ağacı. Expo Go workaround’ları kaldırıldı. |

### Profil / Avatar

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| ProfilePhoto **uri opsiyonel + onError** | `ProfilePhoto.tsx` | `uri` boş/undefined olunca placeholder; yükleme hatasında **onError** ile placeholder (siyah ekran önlenir). |
| Avatar ekranı **onError + placeholder** | `AvatarSelectionScreen.tsx` | Özel profil fotoğrafı yüklenemezse placeholder; **accent** border. |
| Sunucu profil fotoğrafı **Cloudinary** | `server/src/routes/user.ts` | `/me/profile-photo` Cloudinary ile; tam URL döner. |

### Konum (ProfileSetupScreen)

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| Konum izni tek sefer | `ProfileSetupScreen.tsx` | Önce **getForegroundPermissionsAsync()**, izin yoksa **requestForegroundPermissionsAsync()** (1 kere). |

### Diğer

| Değişiklik | Dosya | Not |
|------------|--------|-----|
| Build numarası | `app.config.js` | iOS **buildNumber: '1.0.1'** (sonraki build’de 1.0.2 yapılacak). |
| Script | `package.json` | **start:go** = `expo start --no-dev` (Expo Go’da dev overlay kapalı). |

---

## Branch ve Test Akışı

- **master (main):** iOS’ta yayında olan (1.0.1) sürüm. Sadece **kesinleşmiş, test edilmiş** değişiklikler buraya merge edilir.
- **develop:** Denemeler bu branch’te yapılır (yeni özellikler, Expo Go uyumu, izinler vb.). Asıl uygulamaya dokunmadan burada geliştirirsin.

### Konum / bildirim gibi izinler Expo Go’da sorun çıkarsa

Bu özellikler Expo Go’da bazen **useContext / useEffect of null** hatasına yol açıyor. Nasıl ilerleyeceğiz:

1. **develop** branch’inde çalış: Yeni izin mantığını (konum, bildirim vb.) burada yaz.
2. **Expo Go’da açılmıyorsa** o özelliği Expo Go’da test etmeye çalışma; **gerçek cihaz build’i** ile test et:
   - **Seçenek A:** `eas build --platform ios --profile production` (veya preview) al → TestFlight’a yükle → Telefonda test et.
   - **Seçenek B:** `eas build --platform ios --profile preview` ile development build al → Cihaza kur → `expo start` ile Metro’ya bağlan, canlı test et.
3. Build’de (TestFlight veya preview app) **doğru düzgün çalıştığını** gördükten sonra aynı değişiklikleri **master**’a merge et; sonra production build al.

Yani: İzinli özellikleri **develop**’ta geliştir, **Expo Go yerine build** ile test et, beğenince **master**’a al.

### Branch komutları (özet)

```bash
# develop branch oluştur ve geç (bir kez)
git checkout -b develop

# Günlük: develop'ta çalış
git checkout develop
# ... değişiklikler ...

# Beğenilen değişiklikleri master'a al
git checkout master
git merge develop
# Sonra build al (eas build --platform ios --profile production)
```

---

## Merge Öncesi Kontrol (1.0.1’e Göre)

- [ ] Eşleştirme ayarları: custom slider’lar (mesafe + yaş 18–40+), "En yüksek sparklı eşleş" toggle ve tema renkleri tamam mı?
- [ ] App.tsx: Sade iOS formatı (useEffect + SafeAreaProvider) sorunsuz mu?
- [ ] Profil/avatar: ProfilePhoto ve AvatarSelectionScreen onError/placeholder + sunucu Cloudinary tamam mı?
- [ ] Konum: Sadece ProfileSetup’ta 1 kere isteniyor mu?
- [ ] Sunucu: `preferHighSpark` için **prisma migrate** çalıştırıldı mı? (schema’da yeni alan var.)
- [ ] Build numarası: Yeni build için **buildNumber** artırıldı mı? (örn. 1.0.2)

Bu dosyayı güncelleyerek "1.0.1’den farklı ne yaptık?" sorusunu hep buradan takip edebilirsin.
