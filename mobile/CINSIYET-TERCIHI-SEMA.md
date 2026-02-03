# Cinsiyet Tercihi – Yer Değişikliği Şeması

## Mevcut durum (KALDIRILACAK)
- **Eşleşme Ayarları** ekranında "Cinsiyet Tercihi" bölümü var (Kadın 50💎 | Herkes | Erkek 50💎).
- Bu bölüm **tamamen kaldırılacak**; Eşleşme Ayarları içinde cinsiyet tercihi olmayacak.

---

## Yeni yer (EKLENECEK)

**Ana sayfa (Home)** – "Eşleşme Bul" butonunun **hemen altında**:

```
        ┌─────────────────────────────┐
        │      EŞLEŞME BUL            │
        └─────────────────────────────┘
                    │
        Kartları cevapla, sohbet aç.
                    │
    ┌───────────┬───────────┬───────────┐
    │   ♀       │   🌐      │   ♂       │
    │  Kadın    │  Herkes   │  Erkek    │
    │  50 💎    │ Ücretsiz  │  50 💎    │
    └───────────┴───────────┴───────────┘
         Sol          Orta        Sağ
```

- **Sol:** Kadın simgesi (♀) – 50 elmas – tıklanınca 30 dk boyunca **sadece kadın** cinsiyetle eşleştirir.
- **Orta:** Herkes (rastgele) – **ücretsiz**, seçim yok – varsayılan olarak **başlangıçta seçili**.
- **Sağ:** Erkek simgesi (♂) – 50 elmas – tıklanınca 30 dk boyunca **sadece erkek** cinsiyetle eşleştirir.

## Kurallar
1. **Varsayılan:** Uygulama açıldığında "Herkes" seçili (BOTH).
2. **Kadın veya Erkek** seçilirse 50 elmas kesilir, **30 dakika** boyunca o cinsiyetten eşleşme yapılır (uygulama kapalıyken de süre işler).
3. Eşleşme Ayarları ekranında **cinsiyet tercihi alanı olmayacak**; sadece yaş, mesafe vb. kalacak.

Bu şemaya göre kod güncellenecek.
