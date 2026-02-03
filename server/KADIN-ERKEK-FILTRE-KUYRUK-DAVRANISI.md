# Kadın/Erkek Filtre – Eşleşme ve “Kadın Yoksa Ne Olacak?”

---

## 1. Şu anki davranış (kodda)

### Kadın seçince kimle eşleşir?
- **Sadece kadın (FEMALE)** cinsiyetindeki kullanıcılarla eşleşir.
- **Düzeltme yapıldı:** Önceden cinsiyet filtresi sadece **Prime** kullanıcılar için uygulanıyordu; 50 elmasla Kadın/Erkek seçen normal kullanıcılar filtrelenmiyordu. Artık **herkes** için uygulanıyor (queue’daki `filterGender` MALE/FEMALE ise karşı tarafın cinsiyeti eşleşmeli).

### Kadın (veya Erkek) yoksa ne oluyor?
- Kuyrukta **bekler**; uygun biri (kadın/erkek) kuyruğa girip eşleşebilir olana kadar eşleşme yok.
- **Timeout yok:** Süre dolana kadar (30 dk) kuyrukta kalabilir.
- **Fallback yok:** “X saniye kadın bulunamadı, Herkes’e düş” gibi bir mantık yok; sadece uygun biri gelene kadar beklenir.

---

## 2. İstersen eklenebilecek davranışlar (ürün kararı)

| Seçenek | Açıklama |
|--------|----------|
| **A) Olduğu gibi** | Kadın yoksa bekler; 30 dk bitince otomatik Herkes’e döner. |
| **B) Timeout + mesaj** | Örn. 60 sn sonra “Şu an uygun kadın kullanıcı yok. Beklemeye devam veya Herkes ile eşleş.” gibi bir uyarı. |
| **C) Timeout + otomatik Herkes** | X saniye kadın bulunamazsa o aramada geçici olarak BOTH kabul et (sadece o match için). |
| **D) Beklerken UI metni** | “Sadece kadın ile eşleşiyorsun. Uygun biri bulununca eşleşeceksin.” gibi bilgilendirme. |

Bunlar için backend’de (ör. match:join sonrası periyodik kontrol, timeout event) ve/veya mobilde (süre sonrası “Herkes ile dene” butonu vb.) ek geliştirme gerekir.

---

## 3. Yapılan backend değişikliği (bug fix)

**Dosya:** `server/src/socket/matchmaking.ts`  
**Ne:** Cinsiyet filtresi artık **sadece Prime** değil, **tüm kullanıcılar** için uygulanıyor.  
- `canMatchWithFilters` başında: user1 ve user2’nin `filterGender` (MALE/FEMALE) varsa, karşı tarafın `gender`’ı eşleşmeli; yoksa eşleşme engellenir.  
- Prime’a özel bloklarda sadece yaş ve mesafe kaldı; cinsiyet tek yerde (üstte) kontrol ediliyor.

**Sonuç:** 50 elmasla Kadın veya Erkek seçen herkes, gerçekten sadece o cinsiyetle eşleşir. Kadın/erkek yoksa kuyrukta bekler; timeout veya fallback yok (istersen ayrı feature olarak eklenebilir).
