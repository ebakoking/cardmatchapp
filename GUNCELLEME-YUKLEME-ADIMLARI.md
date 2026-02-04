# Güncellemeleri Yükleme – Basit Adımlar

Bu doküman: **Server (Render)** ve **Mobil (iOS build / TestFlight)** güncellemelerini nasıl yükleyeceğini adım adım anlatıyor.

---

## A. SERVER GÜNCELLEMESİ (Render)

Backend kodu (yeni eşleşme sistemi, 500 soru vs.) **Render**’da çalışıyor. Güncellemek için:

### 1. Kodu Git’e gönder

Bilgisayarında proje klasöründe (Terminal):

```bash
cd /Users/ergunberkatikkurt/cardmatch
git add .
git status
git commit -m "Yeni eşleşme sistemi, 500 soru seed, match route"
git push origin main
```

*(Branch adın `master` ise: `git push origin master` yaz.)*

**Ne olur:** Render, bu repo’ya bağlıysa **push’tan sonra otomatik deploy** başlatır. Render dashboard’da “Deploy” log’unu görebilirsin.

### 2. Render’da deploy’u kontrol et

- Tarayıcıda **https://dashboard.render.com** aç.
- CardMatch backend servisini seç.
- “Events” veya “Logs” kısmında son deploy’un **başarılı** bittiğini kontrol et.

### 3. Migration (veritabanı tabloları)

Yeni eşleşme sistemi için **Prisma migration** çalışmış olmalı. Render’da genelde:

- **Build Command** içinde `prisma generate` ve (isteğe bağlı) `prisma migrate deploy` varsa deploy sırasında zaten çalışır.
- Yoksa Render’da servise gir → **Shell** (veya “Run command”) aç, bağlan. Sonra:

```bash
cd server
npx prisma migrate deploy
```

*(Render’da “Shell” yoksa, kendi bilgisayarında `server/.env`’i production `DATABASE_URL` ile ayarlayıp aynı komutu local’de çalıştırabilirsin; tek seferlik.)*

### 4. 500 soruyu yükle (tek seferlik)

Eşleşme soruları veritabanına bir kez yüklenmeli. Ya Render Shell’de ya da **local’de production DATABASE_URL ile**:

```bash
cd /Users/ergunberkatikkurt/cardmatch/server
npx prisma migrate deploy
npx ts-node prisma/seed-match-questions.ts
```

**Not:** `DATABASE_URL` production veritabanını göstermeli (Render’daki PostgreSQL). Local’de `.env`’e geçici olarak production `DATABASE_URL` koyup bu komutları çalıştırıp sonra kaldırabilirsin.

---

## B. MOBİL GÜNCELLEMESİ (iOS build + TestFlight)

Uygulama güncellemeleri (yeni eşleşme ekranları vs.) **yeni bir iOS build** alıp TestFlight’a yükleyince yansır.

### 1. Build al

Terminal’de:

```bash
cd /Users/ergunberkatikkurt/cardmatch/mobile
eas build --platform ios --profile production
```

**Ne olur:** Expo sunucularında uygulamanın iOS sürümü build edilir. Bittiğinde bir **.ipa** linki verir.

### 2. TestFlight’a yükle

Build bittikten sonra:

```bash
eas submit --platform ios --latest
```

*(İlk seferde Apple hesabı / App Store Connect bağlaman istenebilir.)*

**Alternatif:** Build alırken direkt TestFlight’a göndermek istersen:

```bash
eas build --platform ios --profile production --auto-submit
```

### 3. TestFlight’ta kontrol et

- **https://appstoreconnect.apple.com** → Uygulaman → TestFlight.
- Yeni build “İşleniyor” sonra “Test için hazır” olur.
- Test kullanıcılarına dağıtırsın; kullanıcılar güncellemeyi TestFlight üzerinden indirir.

---

## Özet Tablo

| Ne | Nerede | Ne yapıyorsun |
|----|--------|----------------|
| **Server kodu** | Render | `git add` → `git commit` → `git push` (repo’yu Render’a bağlıysa deploy otomatik). |
| **Veritabanı tabloları** | Render / PostgreSQL | `cd server` → `npx prisma migrate deploy` (Render Shell veya local + production DATABASE_URL). |
| **500 soru** | Aynı veritabanı | `cd server` → `npx ts-node prisma/seed-match-questions.ts` (tek seferlik). |
| **Mobil uygulama** | EAS + TestFlight | `cd mobile` → `eas build --platform ios --profile production` → ardından `eas submit --platform ios --latest`. |

---

## Sıra Önerisi

1. Önce **server**: push → Render deploy → (gerekirse) migration → seed match questions.
2. Sonra **mobile**: `cd mobile` → EAS build → EAS submit.

Böylece önce API ve soru bankası hazır olur, sonra yeni uygulama sürümü bu sunucuya bağlanır.
