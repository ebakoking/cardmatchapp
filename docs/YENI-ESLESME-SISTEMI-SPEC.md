# CardMatch – Yeni Eşleşme Sistemi – Tam Spec (Pro Kurgu)

Bu doküman, senin paylaştığın bileşenler ve etkileşimlerle mevcut Prisma yapısını birleştirir. Revize edilmeden uygulanacak tek referans.

---

## 1. SİSTEM BİLEŞENLERİ VE ETKİLEŞİMLERİ

### 1.1 BOOST SİSTEMİ

| Özellik | Değer |
|--------|--------|
| Fiyat | 199.99 TL |
| Süre | 1 saat aktif |
| Satın alma | Direkt (elmas değil, gerçek para) |

**Ne yapar:**
- Kuyruğa öncelik verir (priority score)
- Doğrulanmış profillerle eşleşme ihtimali artar
- Yüksek spark’lı kullanıcılarla öncelikli eşleşir
- Aktif ve kuyrukta bekleyen premium kullanıcılarla eşleşir

**Veritabanı:** `BoostPurchase` (mevcut) – userId, purchaseDate (activatedAt), expiryDate (expiresAt), isActive türetilir (expiresAt > now), transactionId, priceTL, durationHours.  
**User tarafı:** `User.isBoostActive`, `User.boostExpiresAt` – aktif boost durumu buradan veya BoostPurchase’tan türetilir.

---

### 1.2 CİNSİYET TERCİHİ SİSTEMİ

| Özellik | Değer |
|--------|--------|
| Satın alma | Elmas |
| Süre | 30 dakika aktif |
| Profil (onboarding) | Kadın, Erkek, Diğer |
| Eşleşme tercihi | Kadın, Erkek, Herkes |

**Kurallar:**
- **Profil cinsiyet** = kullanıcının kendisi (User.gender: MALE, FEMALE, OTHER).
- **Eşleşme tercihi** = kiminle eşleşmek istediği (User.interestedIn: MALE, FEMALE, BOTH). Varsayılan BOTH (Herkes).
- **Eşleşme tercihi satın alma (50 elmas, 30 dk):** User.filterGenderActive, User.filterGender (MALE/FEMALE), User.filterGenderExpiresAt. Süre bitince filterGenderActive = false, filterGender = BOTH.
- "Diğer" sadece profil cinsiyeti için; eşleşme tercihinde yok. Diğer seçenekleri herkes görebilir (BOTH ile eşleşir).

**Veritabanı:** User (gender, interestedIn, filterGenderActive, filterGender, filterGenderExpiresAt). `GenderFilterPurchase` (mevcut) – geçmiş satın alımlar.

---

### 1.3 PRIME ÜYELİK ÖZELLİKLERİ

| Özellik | Free | Prime |
|--------|------|--------|
| Yaş filtresi | - | filterMinAge, filterMaxAge |
| Mesafe/konum filtresi | - | filterMaxDistance, latitude, longitude |
| Günlük arkadaş ekleme | 10 | 50 |
| Profil fotoğrafı | Sadece avatar | Özel fotoğraf yükleme (profilePhotoUrl) |
| Prime rozet/çerçeve | - | Profil fotoğrafında (UI) |

**Veritabanı:**
- User: isPrime, primeExpiry, filterMinAge, filterMaxAge, filterMaxDistance, profilePhotoUrl.
- **DailyFriendRequestCount** (yeni): userId, date (gün bazlı), requestCount. maxLimit sorguda: Prime ise 50, değilse 10.

**Profil fotoğrafı kuralı:** Prime bitince yüklenen fotoğraf kalır; yeni yükleme yapılamaz (sadece Prime’da yükleme izni).

---

### 1.4 ETİKET / İLGİ ALANI – 5 SORU MATCH SİSTEMİ

- **5 soru** sabit (sonra admin panelden eklenebilir).
- Her soru **çoktan seçmeli** (MatchQuestion + MatchQuestionOptions).
- Kullanıcı **minimum kaç ortak cevap** ister: **1–5** (UserMatchPreference.minimumCommonAnswers).

**Veritabanı:**
- **MatchQuestion:** id, questionText, orderIndex (1–5), isActive.
- **MatchQuestionOption:** id, questionId, optionText, orderIndex.
- **UserMatchPreference:** userId, minimumCommonAnswers (1–5). Tek satır per user.
- **MatchQueue:** Kuyruk kaydı (userId, enteredAt, priorityScore, filters JSON, status, matchedWithUserId, matchedAt).
- **MatchQueueAnswer:** matchQueueId, questionId, optionId – kuyruğa girerken gönderilen 5 cevap.

---

## 2. ALGORİTMA KURGUSU

### 2.1 KUYRUK ÖNCELİK SKORU (Priority Score)

Sıralama (en yüksekten düşüğe):

1. Boost Aktif + Prime + Doğrulanmış  
2. Boost Aktif + Doğrulanmış  
3. Prime + Doğrulanmış  
4. Boost Aktif  
5. Prime  
6. Doğrulanmış  
7. Normal kullanıcı  

**Hesaplama:**
```ts
priorityScore = 0
if (isBoostActive) priorityScore += 1000
if (isPrime) priorityScore += 500
if (verified) priorityScore += 250
priorityScore += Math.floor(totalSparksEarned / 100)  // spark 0–10000
priorityScore += accountAgeDays  // createdAt ile
```

### 2.2 FİLTRELEME KATMANLARI (Sırayla)

**Katman 1 – Zorunlu:**
- Kullanıcı kendisiyle eşleşemez.
- Daha önce eşleştiği kişilerle eşleşemez (MatchHistory).
- Bloke ettiği / edildiği kişilerle eşleşemez (Block).

**Katman 2 – Cinsiyet tercihi:**
- A’nın tercihi: filterGenderActive ise filterGender (MALE/FEMALE), değilse interestedIn (BOTH = Herkes).
- B’nin profili (gender) A’nın tercihine uyuyor mu; A’nın profili B’nin tercihine uyuyor mu? (OTHER, BOTH kuralları aynı – spec’teki gibi.)

**Katman 3 – Prime filtreleri:**
- A Prime ise: B’nin yaşı [filterMinAge, filterMaxAge], mesafe ≤ filterMaxDistance (160+ = Tüm Türkiye).
- B Prime ise: A için aynı kontrol.

**Katman 4 – Ortak cevap barajı:**
- commonAnswers = 5 soruda aynı optionId seçen sayı.
- requiredCommon = max(A.minimumCommonAnswers, B.minimumCommonAnswers).
- commonAnswers >= requiredCommon olanlar geçer.

**Katman 5 – Aktiflik (opsiyonel):**
- Son X dakikada aktif (lastSeenAt).
- Şu an kuyrukta (status WAITING).
- Başka biriyle aktif sohbet içinde değil (isteğe bağlı).

### 2.3 EŞLEŞME SKORU (Match Score)

Filtreleri geçen adaylar için sıralama:

```ts
matchScore = 0
matchScore += commonAnswers * 200
sparkDiff = Math.abs(userA.totalSparksEarned - userB.totalSparksEarned)
matchScore += Math.max(0, 1000 - sparkDiff)
if (A.isPrime && B.isPrime) matchScore += 300
if (A.verified && B.verified) matchScore += 200
ageDiff = Math.abs(userA.age - userB.age)
if (ageDiff <= 5) matchScore += 100
if (distance < 10 && distance != null) matchScore += 150
```

En yüksek matchScore’lu adayla eşleştir.

### 2.4 KUYRUK ALGORİTMASI (2 saniye döngüsü)

1. Kullanıcı "Eşleş" → 5 soruyu cevaplar → cevaplar kaydedilir (MatchQueue + MatchQueueAnswer), priorityScore hesaplanır, status = WAITING.
2. Her 2 saniyede (veya yeni kullanıcı kuyruğa girince) kuyrukta WAITING olanlar taranır.
3. En yüksek priorityScore’a sahip kullanıcıdan başlanır.
4. Ona uygun adaylar Katman 1–4 (ve istenirse 5) ile filtrelenir.
5. Geçenler için matchScore hesaplanır; en yüksek matchScore’lu adayla eşleştirilir.
6. Match + ChatSession oluşturulur; her iki kullanıcı kuyruktan çıkar (status = MATCHED, matchedWithUserId, matchedAt).
7. match:found emit edilir; client sohbet ekranına yönlendirilir.

---

## 3. VERİTABANI İLİŞKİLERİ (Özet)

```
User
├── BoostPurchase (1:N) – mevcut, User relation eklenebilir
├── GenderFilterPurchase (1:N) – mevcut
├── MatchQueue (1:N) – yeni
├── UserMatchPreference (1:1) – yeni
├── DailyFriendRequestCount (1:N) – yeni
├── MatchHistory (1:N) – mevcut
└── Block, FriendRequest, vb. – mevcut

MatchQuestion
└── MatchQuestionOption (1:N) – yeni

MatchQueue
├── User (N:1)
└── MatchQueueAnswer (1:N) – yeni (questionId, optionId)
```

---

## 4. GÜNLÜK LİMİT VE PROFİL FOTOĞRAFI

- **Günlük arkadaş:** Her gece 00:00’da sayacı sıfırlamak (DailyFriendRequestCount veya FriendRequest sayısı ile). Gönderme = 1; kabul limit sayılmaz. Prime iptal edilirse ertesi gün limit 10’a düşer.
- **Profil fotoğrafı:** Avatar varsayılan. Özel fotoğraf sadece Prime’da yüklenebilir. Prime bitince mevcut fotoğraf kalır, yeni yükleme yapılamaz.

---

## 5. BOOST MANTIĞI

- Boost alan kişi öncelikli; yine de tüm filtre katmanlarına takılır.
- Boost aktifken match bulması garanti değil; sadece öncelik verir.
- Boost süresi boyunca kaç eşleşme yaparsa yapsın süre işler.

---

## 6. SORU YAPISI ÖRNEĞİ (MatchQuestion + MatchQuestionOption)

- Soru 1: Hafta sonlarını nasıl geçirmek istersin? (Doğada, Evde film, Sosyal etkinlik, Spor, Kafe kitap)
- Soru 2: İdeal akşam yemeği? (Romantik restoran, Sokak lezzetleri, Ev yemekleri, Fast food, Fine dining)
- Soru 3: Seyahat tarzın? (Macera, Rahat planlı, Kültürel, Plaj, Kamp/doğa)
- Soru 4: Müzik tercihin? (Pop/Rock, Hip-Hop, Türkçe Pop, Klasik, Elektronik)
- Soru 5: Hayat felsefesi? (YOLO, Planlı, Hırslı, Sakin, Maceracı)

Admin panelden sonra eklenebilir; orderIndex ile sıra korunur.

---

## 7. ÇAKIŞMA DURUMLARI

- Boost + Cinsiyet tercihi: İkisi de aynı anda aktif olabilir.
- Boost + Prime: İkisi de aktif; skorlar toplanır.
- Cinsiyet tercihi süresi bitince: filterGenderActive = false, tercih Herkes (BOTH) sayılır.

Bu spec, veritabanı ve algoritma tek referansıdır; implementasyon buna göre yapılır.
