# Build 1.0.6 – Düzeltmeler ve Test Kontrol Listesi

Bu build’te yapılan değişiklikler ve TestFlight’ta kontrol edilmesi gerekenler.

---

## 1. Elmas (IAP) – Tüm ekranlarda tutarlı akış

| Ne düzeltildi | Nerede | Kontrol |
|----------------|--------|--------|
| Ana sayfadan elmas satın alınca bakiye **anında** güncelleniyor (çıkıp girmeden). | HomeScreen | Ana sayfa → Elmas Al → Paket seç → Satın al → Bakiye hemen artsın; Profil’e girince de aynı bakiye görünsün. |
| Arkadaş sohbetinde “Elmas Satın Al” **gerçek IAP** (önceden “Yakında” idi). | FriendChatScreen – hediye modalı | Arkadaş sohbeti → Elmas hediye et → “Elmas Satın Al” kartına bas → Onay → **App Store** açılsın → Ödeme → “Başarılı! 💎 X elmas hesabınıza eklendi!” |
| Eşleşme sohbetinde “Elmas Satın Al” **gerçek IAP** (önceden mock’tu, App Store’a gitmiyordu). | ChatScreen – hediye modalı | Eşleşme sohbeti → Elmas ikonu → “Elmas Satın Al” paketine bas → Onay → **App Store** açılsın → Ödeme → Başarı mesajı + bakiye güncellensin. |
| Onay metni her yerde **ana sayfa ile aynı**: “X elmas satın almak istediğinize emin misiniz?” + fiyat; başarı: “Başarılı! 💎 X elmas hesabınıza eklendi!” | Tüm elmas satın alma yerleri | Hiçbir yerde “Ödeme App Store üzerinden yapılacak” veya “Yakında” çıkmasın; hep aynı onay + başarı metni. |

**Kısa kontrol:** Ana sayfa, arkadaş sohbeti, eşleşme sohbeti – üçünden de elmas satın al; hepsinde önce onay, sonra App Store, sonra bakiye anında güncellensin.

---

## 2. Cinsiyet filtresi (Kadın / Herkes / Erkek)

| Ne düzeltildi | Kontrol |
|----------------|--------|
| **İlk girişte / uygulama açılışında “Herkes” seçili** (Kadın seçili çıkma sorunu). | Uygulamayı aç → Cinsiyet satırında **Herkes** (🌐) seçili olsun. Daha önce Kadın/Erkek kullanıp süresi dolmuşsa da açılışta yine Herkes görünsün. |
| **30 dk sayacı:** Kadın veya Erkek seçilip 50 elmas kullanıldığında buton içinde “X dk” + **altında “Aktif • X dk kaldı” şeridi**. | Kadın veya Erkek → 50 elmas kullan → İlgili butonda “30 dk” (veya kalan dakika) görünsün; hemen altında **Aktif • X dk kaldı** şeridi çıksın. |
| Süre bitince **otomatik “Herkes”e** dönme. | 30 dk beklemek yerine: sunucu tarafında süre dolunca veya uygulama yeniden açılınca seçim Herkes olsun (test için backend’de süreyi kısaltabilirsin veya bir sonraki girişte kontrol et). |
| “Ücretsiz” yazısı kaldırıldı. | Herkes butonunun altında “Ücretsiz” yazısı **olmasın**. |

**Kısa kontrol:** Kadın/Erkek kullan → “Aktif • X dk kaldı” şeridi görünsün; uygulama kapat-aç veya süre bitince Herkes seçili olsun.

---

## 3. Backend (sunucu)

| Ne düzeltildi | Kontrol |
|----------------|--------|
| **GET /api/auth/me** – Cinsiyet filtresi süresi dolmuşsa kullanıcı **BOTH** (Herkes) olarak dönüyor ve DB güncelleniyor. | İlk girişte veya süresi dolmuş filtre ile girişte auth/me’den gelen user’da `filterGender: 'BOTH'` olsun; uygulama açılışında Herkes seçili görünsün. |

---

## 4. Özet kontrol sırası (TestFlight 1.0.6)

1. **Giriş:** Uygulama aç → Cinsiyet satırında **Herkes** seçili mi?
2. **Elmas – Ana sayfa:** Elmas Al → 50/100/250 seç → Onay → App Store → Ödeme (sandbox) → “Başarılı! 💎” → Bakiye anında arttı mı? Profil’e girince aynı bakiye görünüyor mu?
3. **Elmas – Arkadaş sohbeti:** Bir arkadaşla sohbet → Elmas hediye et → “Elmas Satın Al” kartı → Onay → App Store → Ödeme → Başarı + bakiye güncellendi mi?
4. **Elmas – Eşleşme sohbeti:** Eşleşme bul → Sohbet ekranında Elmas → “Elmas Satın Al” → Onay → App Store → Ödeme → Başarı + bakiye güncellendi mi?
5. **Cinsiyet filtresi:** Kadın veya Erkek → 50 elmas kullan → “30 dk” butonda + “Aktif • X dk kaldı” şeridi görünüyor mu? Herkes butonunda “Ücretsiz” yok mu?
6. **Profil / diğer:** Profil fotoğrafı (Prime), Boost, Prime satın alma – önceki build’te çalışıyorsa aynı şekilde çalışıyor mu?

---

## 5. Bilinen sınırlar (bu build’te değişmedi)

- **Backend receipt doğrulama** yok: Elmas/Boost/Prime için sunucu Apple receipt kontrol etmiyor (`IAP-VE-ABONELIK-DENETIM-RAPORU.md`).
- **Agora arama:** Token alınıyor; cold start veya ağ hatası olursa “Sunucudan güvenlik anahtarı alınamadı” vb. mesajlar çıkabilir – Render cold start / env kontrolü.

Bu listeyi TestFlight’ta 1.0.6 ile denerken kullanabilirsin.
