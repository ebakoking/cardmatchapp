# Profil fotoğrafı yükleme – Build’te yapılan düzeltmeler

Bu dosya, profil fotoğrafı ekleme sorununu gidermek için yapılan değişiklikleri listeler. **Build aldığında bu düzeltmeler dahildir.**

---

## 1. Mobil – API (api.ts)

**Sorun:** FormData ile istek atarken axios bazen `Content-Type: multipart/form-data` ekliyor ama **boundary** eklemiyordu. Sunucu multipart’ı parse edemiyor, `req.file` undefined kalıyordu.

**Düzeltme:** Tüm FormData isteklerinde `Content-Type` header’ı **kaldırılıyor**; böylece runtime doğru boundary ile ayarlıyor.

```ts
if (config.data instanceof FormData) {
  delete (config.headers as any)['Content-Type'];
}
```

**Sonuç:** Profil fotoğrafı, galeri fotoğrafı vb. tüm FormData yüklemeleri sunucuya doğru gidiyor.

---

## 2. Mobil – AvatarSelectionScreen (profil fotoğrafı ekranı)

**Sorun:** Bazı cihazlarda galeriden gelen URI formatı farklı (file://, content://, ph://); yanlış format sunucuya iletilebiliyordu.

**Düzeltme:**
- URI `file://`, `content://` veya `ph://` ile başlıyorsa **olduğu gibi** kullanılıyor.
- Diğer durumlarda `file://` öneki ekleniyor.
- FormData alan adı: **photo** (sunucu `upload.single('photo')` bekliyor).
- Content-Type **manuel eklenmiyor** (api.ts’te kaldırılıyor).

**Sonuç:** iOS (ph://) ve Android (content://, file://) ile galeriden seçilen fotoğraf doğru gönderiliyor.

---

## 3. Sunucu – user.ts (profile-photo endpoint)

**Sorun:** React Native bazen dosya ile birlikte **mimetype** göndermiyor veya `application/octet-stream` gönderiyordu. Multer `image/*` beklediği için dosyayı reddedebiliyordu.

**Düzeltme:** Profil fotoğrafı için **ayrı bir multer** (`uploadProfilePhoto`) kullanılıyor:
- `image/*` kabul ediliyor.
- **Boş mimetype** veya **application/octet-stream** da kabul ediliyor.

**Sonuç:** İstemci yanlış/eksik mimetype gönderse bile sunucu dosyayı kabul edip Cloudinary’e (veya local’e) yüklüyor.

---

## Build’te kesin olması için

1. **Mobil:** api.ts, AvatarSelectionScreen.tsx değişiklikleri **build’e dahil** (kodda mevcut).
2. **Sunucu:** user.ts değişikliği **Render’da deploy edilmiş olmalı**. Git push veya Render dashboard’dan “Manual Deploy” ile backend’i güncelle.
3. **Test:** Prime kullanıcı ile giriş yap → Profil / Avatar seçimi → Galeriden fotoğraf seç → Yükle. “Başarılı, profil fotoğrafın güncellendi!” mesajı gelmeli.

Bu üç düzeltme build’te ve sunucuda aktifse profil fotoğrafı ekleme çalışır.
