# Apple’da Gerçek Para – Adım Adım

TestFlight’ta bile kullanıcılar gerçek para ödediğinde paranın senin hesabına geçmesi için Apple tarafında şunlar gerekir. **Tek tek** yap.

---

## BÖLÜM 1: Sözleşme, Banka, Vergi (Paranın hesabına geçmesi için)

Bu üçü tamamlanmadan Apple ödeme göndermez.

---

### Adım 1: App Store Connect’e gir

1. Tarayıcıda aç: **https://appstoreconnect.apple.com**
2. Apple Developer hesabınla (Apple ID) giriş yap.

Bunu yaptıysan bir sonraki adıma geç.

---

### Adım 2: Sözleşmeler (Agreements)

1. App Store Connect’te **sol menüden** en altta **“Sözleşmeler, Vergi ve Bankacılık”** veya **“Agreements, Tax, and Banking”** tıkla.
2. **“Sözleşmeler” / “Agreements”** sekmesine gir.
3. **“Paid Applications”** (Ücretli Uygulamalar) satırına bak:
   - **“Güncelle” / “Update”** veya **“Kabul Et” / “Accept”** yazıyorsa tıkla.
   - Sözleşmeyi oku, gerekli yerleri doldur (şirket/ad, adres vb.) ve **gönder / kabul et**.

Bu sözleşme imzalanmadan uygulama içi satın alma geliri bağlanamaz. Bunu bitir, sonra Adım 3’e geç.

---

### Adım 3: Banka bilgisi (Ödemelerin geleceği hesap)

1. Aynı sayfada **“Banka Bilgisi” / “Banking Information”** bölümüne gir.
2. **“Banka Hesabı Ekle” / “Add Bank Account”** (veya benzeri) tıkla.
3. Banka adı, IBAN (veya Apple’ın istediği formatta hesap numarası), para birimi (örn. TRY veya USD) gir.
4. Kaydet.

Apple ödemeleri bu hesaba gönderir. Bunu doldur, sonra Adım 4’e geç.

---

### Adım 4: Vergi bilgisi (Tax)

1. Aynı sayfada **“Vergi Formları” / “Tax Forms”** bölümüne gir.
2. Apple’ın istediği vergi formunu seç (Türkiye için genelde W-8BEN veya benzeri).
3. Formu doldur (ad, adres, vergi kimlik numarası vb.) ve gönder.

Bunlar onaylanmadan ödeme yapılmaz. Bunu da tamamla.

---

## BÖLÜM 2: Uygulama İçi Satın Alma Ürünleri (Prime, Elmas vb.)

Paranın “hangi üründen” geleceğini burada tanımlarsın.

---

### Adım 5: CardMatch uygulamasını seç

1. App Store Connect’te **“Uygulamalar” / “Apps”** tıkla.
2. **CardMatch** uygulamasını seç.

---

### Adım 6: In-App Purchase ürünleri oluştur

1. CardMatch sayfasında sol menüden **“Uygulama İçi Satın Almalar” / “In-App Purchases”** (veya **“Monetization”** altında) tıkla.
2. **“+”** veya **“Yeni Ürün Oluştur”** tıkla.

Şu ürünleri **tek tek** ekleyebilirsin (uygulamandaki Prime ve Elmas paketleriyle eşleşecek):

- **Prime abonelik (Subscription):**  
  Örn. “CardMatch Prime Aylık”, “CardMatch Prime Yıllık”  
  Ürün ID: uygulama kodunda kullanacağın ID (örn. `prime_monthly`, `prime_yearly`).

- **Elmas paketleri (Consumable):**  
  Örn. “50 Elmas”, “100 Elmas”, “250 Elmas”  
  Ürün ID: örn. `tokens_50`, `tokens_100`, `tokens_250`.

Her ürün için: **Referans adı**, **Ürün ID** (İngilizce, boşluksuz), **fiyat** (Türk Lirası veya seçtiğin para birimi) gir ve kaydet.

---

## Özet

| Sıra | Ne yapacaksın | Nerede |
|-----|----------------|--------|
| 1 | App Store Connect’e giriş yap | appstoreconnect.apple.com |
| 2 | Paid Applications sözleşmesini kabul et | Sözleşmeler, Vergi ve Bankacılık → Sözleşmeler |
| 3 | Banka hesabı ekle | Aynı sayfa → Banka Bilgisi |
| 4 | Vergi formunu doldur | Aynı sayfa → Vergi Formları |
| 5 | CardMatch uygulamasını aç | Uygulamalar → CardMatch |
| 6 | In-App Purchase ürünleri oluştur (Prime, Elmas) | CardMatch → Uygulama İçi Satın Almalar |

Bu adımlar bittikten sonra TestFlight’ta gerçek ödeme almak için uygulama kodunda **gerçek IAP** (StoreKit / RevenueCat) entegrasyonu yapılır; şu an uygulama simülasyon kullanıyor.

**Şimdilik sadece Adım 1’i yap:** App Store Connect’e gir. Sonra “girdim” de, Adım 2’yi anlatayım.
