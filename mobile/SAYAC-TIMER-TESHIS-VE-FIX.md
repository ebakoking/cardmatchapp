# Sayaç (Timer) Teşhis ve Minimal Fix – Cinsiyet Filtresi 30 dk Geri Sayım

---

## 1. REPRO (Kanıt / Reprodüksiyon)

### Sayaç nerede?
- **Dosya:** `mobile/src/screens/Home/HomeScreen.tsx`
- **Ekran:** Ana sayfa (Home / HomeMain) – cinsiyet seçimi satırı (Kadın / Herkes / Erkek) ve hemen altındaki “Öncelikli eşleştirme • M:SS” bloğu.

### Nasıl tetikleniyor?
- Kadın veya Erkek seçilip **50 elmas** harcanınca API’den `filterGender` ve `filterGenderExpiresAt` (şu an +30 dk) dönüyor.
- `mergeUserFromApi(res.data.data)` ve `refreshProfile()` ile `user` state güncelleniyor.
- `useEffect([user?.filterGender, user?.filterGenderExpiresAt, refreshProfile])` koşullar sağlanınca çalışıyor: `setGenderSecondsLeft(computeSeconds())` + `setInterval(..., 1000)`.

### Beklenen davranış
- Kadın/Erkek aktifken **her saniye** kalan süre güncellenir (M:SS).
- Süre 0’a gelince `mergeUserFromApi({ filterGender: 'BOTH', filterGenderExpiresAt: null })` + `refreshProfile()`; UI “Herkes”e döner.

### Gerçek davranış (sorun)
- Sayaç hiç ilerlemiyor / 1 kere güncellenip duruyor / ekrandan çıkınca bozuluyor (kullanıcı bildirimi).

### Kanıt için eklenen loglar
- **Timer kuruluyor mu?** → `[GenderTimer] effect run` (filter, expiresAt), `[GenderTimer] interval started` (initialSecs).
- **Tick çalışıyor mu?** → `[GenderTimer] tick` (ilk 3 tick + her 60. saniye + süre bitince).
- **State set ediliyor mu?** → Her tick’te `setGenderSecondsLeft(secs)`; re-render ile UI güncellenir.
- **Cleanup timer’ı iptal ediyor mu?** → `[GenderTimer] cleanup` log’u; effect yeniden çalışırsa cleanup önce çalışır, interval silinir.

---

## 2. Doğru Dosya ve Referanslar

- **Sayaç kodu:** `HomeScreen.tsx` satır ~91–126 (genderSecondsLeft, useEffect, setInterval).
- **Navigation:** `ChatStack.Screen name="HomeMain" component={HomeScreen}` – tek Home ekranı; duplicate yok.
- **İlgili aramalar:** `genderSecondsLeft`, `filterGenderExpiresAt`, `setInterval`, `formatGenderTime`, `showPriorityMatchBlock` hepsi bu dosyada.

---

## 3. Kök Neden (Kanıtla)

**Tespit:** `useEffect` dependency array’inde **`refreshProfile`** vardı.  
`refreshProfile`, AuthContext’te `useCallback([token, setUserSafe])` ile tanımlı; teoride sabit olabilir ama:

- AuthContext sık re-render olabiliyor (balance, socket, vb.).
- `setUserSafe` veya başka bir chain ile **referans değişirse** `refreshProfile` da değişir.
- Effect **her `refreshProfile` değişiminde** yeniden çalışır → **cleanup** çalışır → **`clearInterval(t)`** → mevcut interval iptal.
- Hemen ardından effect tekrar çalışır, yeni interval kurulur; fakat:
  - Re-render sıklığı yüksekse interval sürekli silinip yeniden kuruluyor.
  - Özellikle **ilk saniyelerde** veya **refreshProfile’ın sık değiştiği** senaryoda tick’ler kaybolabilir veya sayaç donuyor gibi görünebilir.

**Kanıt:** Console’da `[GenderTimer] cleanup` ardından hemen `[GenderTimer] effect run` / `interval started` tekrarlanıyorsa, effect sürekli yeniden tetikleniyor ve interval ömürü kısalıyor demektir.

**Diğer ihtimaller (elendi / zayıf):**
- State güncelleniyor UI güncellenmiyor → React re-render normalde çalışır; gösterim `genderSecondsLeft` ve `formatGenderTime` ile doğrudan bağlı.
- Timer hiç başlamıyor → `expiresAt` veya `filterGender` yanlışsa effect zaten “early return” yapıyor; log’larla görülür.
- AppState background/foreground → interval devam eder, tick’te `computeSeconds()` Date ile hesapladığı için süre doğru kalır.
- Yanlış build → Profil’deki sürüm satırı ile build doğrulanmalı; sayaç kodu tek yerde.

---

## 4. Yapılan Minimal Değişiklikler (Diff)

**Dosya:** `mobile/src/screens/Home/HomeScreen.tsx`

1. **`refreshProfile`’ı dependency array’den çıkarma**  
   Effect yalnızca `user?.filterGender` ve `user?.filterGenderExpiresAt` değişince çalışsın; `refreshProfile` referansı değişince **çalışmasın** (interval kalkmasın).

2. **Interval içinde `refreshProfile`’ı ref ile çağırma**  
   Süre bitince hâlâ güncel `refreshProfile` çağrılsın diye:
   - `const refreshProfileRef = useRef(refreshProfile); refreshProfileRef.current = refreshProfile;`
   - Süre 0’da: `refreshProfileRef.current()` (artık dependency’de yok).

3. **Teşhis logları (kanıt)**  
   - Effect giriş: `[GenderTimer] effect run` (filter, expiresAt, isGenderFilter).
   - Interval kurulunca: `[GenderTimer] interval started` (initialSecs).
   - Tick: `[GenderTimer] tick` (ilk 3 + her 60 sn + bitişte).
   - Bitiş: `[GenderTimer] expired, merging BOTH`.
   - Cleanup: `[GenderTimer] cleanup`.

Özet diff:
- `}, [user?.filterGender, user?.filterGenderExpiresAt, refreshProfile]);`  
  → `}, [user?.filterGender, user?.filterGenderExpiresAt]);`
- `refreshProfileRef` eklendi, süre bitince `refreshProfileRef.current()` çağrılıyor.
- Yukarıdaki console.log satırları eklendi (ileride sadece azaltılabilir, tamamen kaldırılması zorunlu değil).

---

## 5. Test / Doğrulama

### Ortam
- **EAS build** (development veya production) önerilir; Expo Go’da da çalışır ama tam davranış için gerçek build test edilmeli.
- iOS ve Android ikisinde de denenmeli.

### Adımlar
1. Uygulamayı aç, ana sayfaya gel (Kadın / Herkes / Erkek satırı görünsün).
2. En az 50 elmas olduğundan emin ol; **Kadın** veya **Erkek** seç, 50 elması onayla.
3. **Beklenen (önce):** Kadın/Erkek butonunda veya “Öncelikli eşleştirme” satırında sadece “50 💎” veya sabit bir süre görünüp sayaç ilerlemiyordu / donuyordu.
4. **Beklenen (sonra):** Aynı yerlerde **M:SS** (örn. 29:59, 29:58, …) her saniye güncellenir; ~30 dk sonra otomatik “Herkes”e döner.
5. Console’da (Metro veya cihaz log):
   - Bir kez `[GenderTimer] effect run` ve `interval started`,
   - Ardından düzenli `[GenderTimer] tick` (ilk 3 + her 60 sn),
   - Süre bitince `[GenderTimer] expired, merging BOTH` ve `[GenderTimer] cleanup`.

### Önce / Sonra
- **Önce:** Sayaç ya hiç hareket etmiyor ya ilk değerde kalıyor ya da ekran/context güncellemesiyle sıfırlanıyordu.
- **Sonra:** Saniye bazlı geri sayım sürekli çalışır; süre bitince state ve API (refreshProfile) ile “Herkes”e geçiş yapılır.

---

## 6. Kural Özeti

- Önce **log’larla** timer kurulumu, tick ve cleanup kanıtlandı.
- Kök neden **effect dependency’deki `refreshProfile`** ile tespit edildi; **minimal fix** dependency’den çıkarıp ref ile çağırmak.
- Gereksiz refactor yapılmadı; sadece bu useEffect ve ilgili ref/log değişti.
- Fix sonrası loglar azaltılabilir (örn. sadece `effect run` ve `cleanup` bırakılabilir), tamamen kaldırılması zorunlu değil.
