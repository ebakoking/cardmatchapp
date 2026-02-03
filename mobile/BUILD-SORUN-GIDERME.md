# Build'lerin Yansımaması / Güncellemelerin Görünmemesi

Bu rehber, "yeni build aldım ama değişiklikler yansımıyor" veya "hiçbir build işe yaramıyor" gibi durumları adım adım çözmek için yazıldı.

---

## 1. Hangi Sürüm Yüklü? (Önce Bunu Doğrula)

- **Profil** sekmesine gir → en alta scroll et.
- **"Sürüm 0.1.0 (Build 1.0.8)"** gibi bir satır göreceksin.
- Eğer **Build 1.0.7, 1.0.6** vb. görüyorsan, cihazda **eski build** var; yeni build’i TestFlight’tan **yeniden yüklemen** gerekir.

**Özet:** Güncellemelerin yansımamasının en sık nedeni, TestFlight’ta yeni build olsa bile cihazda **eski build’in açık kalması**dır. Yeni build’i mutlaka **yükle** (Install) edip uygulamayı **yeniden başlat**.

---

## 2. Config Çakışması (app.json vs app.config.js)

Projede iki config var:

- **`app.config.js`** → EAS Build ve Expo bunu **asıl kaynak** olarak kullanır (version, buildNumber, .env vb. burada).
- **`app.json`** → Bazı araçlar bunu da okuyabilir; **buildNumber** burada **1.0.8** ile senkronize edildi.

**Yapman gereken:** Sürüm/build değiştirdiğinde **her zaman** `app.config.js` içindeki `version` ve `ios.buildNumber`’ı güncelle. İstersen `app.json` içindeki `buildNumber`’ı da aynı yap (şu an 1.0.8).

---

## 3. EAS Build Cache (Eski Native Build Kullanılıyor Olabilir)

Kod değiştiği halde davranış değişmiyorsa EAS **cache**’den eski native build kullanıyor olabilir.

**Çözüm: Cache’siz temiz build al**

```bash
cd mobile
eas build --platform ios --profile production --clear-cache
```

- `--clear-cache` bir kerelik **temiz** build alır; sonraki build’lerde gerek yok.
- Build bittikten sonra **yeni build’i** App Store Connect’e submit edip TestFlight’a düşmesini bekle, sonra cihaza **yeni build’i yükle**.

---

## 4. TestFlight’ta Doğru Build’i Yüklemek

1. **TestFlight** uygulamasını aç.
2. CardMatch’i seç.
3. **"Güncelle"** / **"Update"** varsa tıkla; yoksa build numarasına bak (örn. 1.0.8).
4. En son gönderdiğin build (örn. 1.0.8) listede görünüyorsa onu **Install** et.
5. Kurulum bitince uygulamayı **tamamen kapat** ve tekrar aç.
6. **Profil → Sürüm** satırında **Build 1.0.8** (veya hangi build’i yüklediysen) yazdığını kontrol et.

---

## 5. Özet Kontrol Listesi

| Adım | Yap |
|------|-----|
| 1 | `app.config.js` içinde `version` ve `ios.buildNumber` güncel mi? (örn. 1.0.8) |
| 2 | Yeni build’i **cache’siz** aldın mı? `eas build --platform ios --profile production --clear-cache` |
| 3 | Yeni build’i App Store Connect’e **submit** ettin mi? |
| 4 | TestFlight’tan **doğru build’i** (örn. 1.0.8) cihaza **yükledin** mi? |
| 5 | Uygulamayı **kapattın** ve **yeniden açtın** mı? |
| 6 | **Profil → en alt** sürüm satırında doğru build numarası görünüyor mu? |

Bu adımlar tamamsa, kod ve config’teki güncellemeler **mutlaka** yansır. Sorun devam ederse büyük ihtimalle ya **eski build** açık ya da **yanlış build** yüklü demektir; sürüm satırı bunu net gösterir.
