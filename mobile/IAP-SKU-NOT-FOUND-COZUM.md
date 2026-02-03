# "SKU not found" / "Product ID bulunamadı" Çözümü

Satın alma (Elmas, Prime, Boost) denediğinde **"SKU not found"** veya benzeri hata alıyorsan, uygulamadaki **Product ID** ile **App Store Connect**’te tanımlı Product ID aynı değildir.

## 1. App Store Connect’te Product ID’leri kontrol et

1. [App Store Connect](https://appstoreconnect.apple.com) → **Uygulamalar** → **CardMatch**
2. **Uygulama İçi Satın Almalar** (In-App Purchases) bölümüne gir
3. Her ürünün **Product ID** alanına bak (Referans adı değil, **Product ID**)

Örnek:  
- "50 Elmas" ürününün Product ID’si `cardmatch_diamond_50` mi, `com.cardmatch.app.diamond_50` mı, yoksa başka bir şey mi?

## 2. İki yol

### A) App Store Connect’teki ID’leri uygulamaya vermek (önerilen)

App Store Connect’te **zaten farklı Product ID** kullandıysan (örn. `com.cardmatch.app.diamond_50`), uygulamanın bu ID’leri kullanması gerekir.

**mobile** klasöründe `.env` dosyasına ekle (App Store Connect’te gördüğün Product ID’leri yaz):

```env
EXPO_PUBLIC_IAP_DIAMOND_50=com.cardmatch.app.diamond_50
EXPO_PUBLIC_IAP_DIAMOND_100=com.cardmatch.app.diamond_100
EXPO_PUBLIC_IAP_DIAMOND_250=com.cardmatch.app.diamond_250
EXPO_PUBLIC_IAP_BOOST_1H=com.cardmatch.app.boost_1h
EXPO_PUBLIC_IAP_PRIME_WEEKLY=com.cardmatch.app.prime_weekly
EXPO_PUBLIC_IAP_PRIME_MONTHLY=com.cardmatch.app.prime_monthly
EXPO_PUBLIC_IAP_PRIME_YEARLY=com.cardmatch.app.prime_yearly
```

Buradaki değerleri kendi Product ID’lerinle değiştir. Sonra projeyi yeniden başlat / yeni build al.

### B) App Store Connect’te Product ID’leri uygulamayla eşleştirmek

Yeni ürün ekliyorsan veya düzenleyebiliyorsan, App Store Connect’te Product ID’leri şu şekilde tanımla (uygulama varsayılan olarak bunları kullanıyor):

| Ürün        | Product ID (birebir böyle olmalı) |
|------------|-----------------------------------|
| 50 Elmas   | `cardmatch_diamond_50`            |
| 100 Elmas  | `cardmatch_diamond_100`          |
| 250 Elmas  | `cardmatch_diamond_250`          |
| Boost 1 saat | `cardmatch_boost_1h`           |
| Prime Haftalık | `cardmatch_prime_weekly`    |
| Prime Aylık   | `cardmatch_prime_monthly`    |
| Prime Yıllık  | `cardmatch_prime_yearly`     |

## 3. Ek kontrol

- Ürünler **Satın Alınabilir** (Cleared for Sale) ve uygulama sürümüne bağlı mı?
- TestFlight / Sandbox ile test ederken **Sandbox Apple ID** kullanıyor musun?

Bu adımlardan sonra hâlâ "SKU not found" alırsan, kullandığın **tam hata mesajı** ve App Store Connect’te gördüğün **Product ID**’leri paylaşırsan devam edebiliriz.
