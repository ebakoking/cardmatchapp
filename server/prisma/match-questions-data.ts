/**
 * 500 eşleşme sorusu – her biri 4 seçenek (kişilik, sohbet, gündem).
 * Her şablon: 4 seçenek + 5 soru metni → 100 şablon × 5 = 500 soru.
 */
export type QuestionTemplate = { options: [string, string, string, string]; questions: string[] };

const TEMPLATES: QuestionTemplate[] = [
  {
    options: ['Doğada vakit geçirerek', 'Evde film/dizi izleyerek', 'Sosyal etkinliklerde', 'Spor yaparak'],
    questions: [
      'Hafta sonlarını nasıl geçirmek istersin?',
      'Boş bir günde ilk tercihin ne olur?',
      'Tatil gününde seni en çok ne mutlu eder?',
      'Hafta sonu planın genelde ne olur?',
      'Serbest zamanında en çok ne yaparsın?',
    ],
  },
  {
    options: ['Romantik restoran', 'Sokak lezzetleri', 'Ev yemekleri', 'Fine dining'],
    questions: [
      'İdeal bir akşam yemeği nerede olsun?',
      'İlk buluşmada yemek tercihin?',
      'Özel bir günde nerede yemek yersin?',
      'Sevgiliyle yemek tercihin?',
      'Akşam yemeği tarzın?',
    ],
  },
  {
    options: ['Macera dolu', 'Rahat ve planlı', 'Kültürel turlar', 'Plaj tatili'],
    questions: [
      'Seyahat tarzın nasıl?',
      'Tatilde ne tür aktivite ararsın?',
      'Yeni bir şehirde ilk ne yaparsın?',
      'Seyahatte seni ne mutlu eder?',
      'İdeal tatil tarzın?',
    ],
  },
  {
    options: ['Pop/Rock', 'Hip-Hop/Rap', 'Türkçe Pop', 'Elektronik/House'],
    questions: [
      'Müzik tercihin ne?',
      'Araba yolculuğunda ne dinlersin?',
      'Partide hangi tür çalsın?',
      'Çalışırken ne dinlersin?',
      'En çok hangi müzik türünü seversin?',
    ],
  },
  {
    options: ['YOLO - Anı yaşa', 'Planlı ve dikkatli', 'Hırslı ve hedef odaklı', 'Sakin ve huzurlu'],
    questions: [
      'Hayat felsefen nasıl?',
      'Kararlarında genelde nasıl davranırsın?',
      'Hayatta en çok neye önem verirsin?',
      'Yaşam tarzın nasıl tanımlanır?',
      'Günlük hayatta nasıl bir insansın?',
    ],
  },
  {
    options: ['Kafede sohbet', 'Evde film', 'Doğa yürüyüşü', 'Alışveriş'],
    questions: [
      'İlk buluşmada nerede olmak istersin?',
      'Tanışma ortamı tercihin?',
      'Randevuda nereye gitmek istersin?',
      'Yeni biriyle nerede vakit geçirirsin?',
      'Buluşma mekânı tercihin?',
    ],
  },
  {
    options: ['Evet, sık sık', 'Bazen', 'Nadiren', 'Hayır, tercih etmem'],
    questions: [
      'Sosyal medyada sık paylaşım yapar mısın?',
      'Hikaye paylaşmayı sever misin?',
      'Anlık paylaşım yapar mısın?',
      'Günlük paylaşım alışkanlığın var mı?',
      'Sosyal medyada aktif misin?',
    ],
  },
  {
    options: ['Sabah erken', 'Öğleden sonra', 'Akşam', 'Gece geç'],
    questions: [
      'En verimli olduğun saat hangisi?',
      'Sporu ne zaman yaparsın?',
      'Çalışmayı ne zaman tercih edersin?',
      'En enerjik olduğun saat?',
      'Günün en sevdiğin saati?',
    ],
  },
  {
    options: ['Komedi', 'Drama', 'Bilim kurgu', 'Romantik'],
    questions: [
      'Film türü tercihin?',
      'Netflix\'te ne izlersin?',
      'Sinemada ne tür film seçersin?',
      'Evde film seçerken ne tercih edersin?',
      'En sevdiğin film türü?',
    ],
  },
  {
    options: ['Kedi', 'Köpek', 'Kuş', 'Evcil hayvan istemem'],
    questions: [
      'Evcil hayvan tercihin?',
      'İleride evcil hayvan alır mısın?',
      'En sevdiğin hayvan?',
      'Evde hangi hayvan olsun isterdin?',
      'Hayvan sevgisi konusunda nasılsın?',
    ],
  },
  {
    options: ['Kahve', 'Çay', 'Soğuk içecek', 'Smoothie'],
    questions: [
      'Günlük içecek tercihin?',
      'Kafede ne sipariş edersin?',
      'Sabah ne içersin?',
      'Çalışırken ne içersin?',
      'En sevdiğin içecek?',
    ],
  },
  {
    options: ['Kitap', 'Podcast', 'Müzik', 'Sessizlik'],
    questions: [
      'Yolda ne yaparsın?',
      'Uzun yolculukta ne dinlersin?',
      'Toplu taşımada ne yaparsın?',
      'Boş zamanında ne dinlersin?',
      'Kulaklıkla ne dinlersin?',
    ],
  },
  {
    options: ['Spor', 'Yürüyüş', 'Yoga', 'Spor yapmam'],
    questions: [
      'Fiziksel aktivite tercihin?',
      'Sağlık için ne yaparsın?',
      'Hareket etmek için ne seçersin?',
      'Egzersiz tarzın?',
      'Aktif yaşam için ne yaparsın?',
    ],
  },
  {
    options: ['Evet, çok', 'Biraz', 'Nadiren', 'Hiç'],
    questions: [
      'Emoji kullanmayı sever misin?',
      'Mesajlarda emoji kullanır mısın?',
      'Sohbette emoji tercihin?',
      'Yazışırken emoji kullanır mısın?',
      'Emoji kullanımın nasıl?',
    ],
  },
  {
    options: ['Hemen cevap veririm', 'Birkaç saat içinde', 'Gün içinde', 'Yoğunsam ertesi gün'],
    questions: [
      'Mesajlara ne kadar sürede cevap verirsin?',
      'Sohbet cevap hızın nasıl?',
      'Mesajlara tepki süren?',
      'Yazışmada ne kadar hızlısın?',
      'Cep telefonunda cevap alışkanlığın?',
    ],
  },
  {
    options: ['Sesli mesaj', 'Yazı', 'Görüntülü arama', 'Kısa not'],
    questions: [
      'İletişimde ne tercih edersin?',
      'Uzun sohbetlerde ne kullanırsın?',
      'Anlatmak için ne seçersin?',
      'Mesajlaşmada ne tür iletişim?',
      'En rahat iletişim şeklin?',
    ],
  },
  {
    options: ['Merhaba + gülücük', 'Selam, nasılsın?', 'Profilinden bir şey söyle', 'Direkt soru sorarım'],
    questions: [
      'İlk mesajda ne yazarısın?',
      'Tanışma mesajın nasıl olur?',
      'İlk yazışmada ne dersin?',
      'Biriyle ilk mesajında ne yazarsın?',
      'Sohbet açılışın nasıl?',
    ],
  },
  {
    options: ['Evet, hemen', 'Birkaç gün sonra', 'Kendimi hazır hissedersem', 'Önce sohbet yeterli'],
    questions: [
      'İlk buluşmaya ne kadar sürede gidersin?',
      'Tanıştıktan ne kadar sonra buluşmak istersin?',
      'Randevu için ne kadar beklerdin?',
      'Buluşma kararını ne zaman verirsin?',
      'İlk buluşma zamanlaması nasıl olsun?',
    ],
  },
  {
    options: ['Saatlerce sohbet', 'Kısa ve öz', 'Konuya göre değişir', 'Sesli/görüntülü tercih'],
    questions: [
      'Sohbet süresi tercihin?',
      'Mesajlaşmada ne kadar uzun yazarsın?',
      'Yazışma tarzın nasıl?',
      'Sohbet derinliği tercihin?',
      'İletişimde uzunluk tercihin?',
    ],
  },
  {
    options: ['Evet, önemli', 'Bazen', 'Pek önemsemem', 'Hayır'],
    questions: [
      'Son görülme bilgisi önemli mi?',
      'Mesajda "son görülme" takip eder misin?',
      'Cevap süresi seni etkiler mi?',
      'Online olma durumu önemli mi?',
      'Aktif sohbet senin için önemli mi?',
    ],
  },
  {
    options: ['Gündem takip ederim', 'Spor/Magazin', 'Eğlence', 'Takip etmem'],
    questions: [
      'Gündem takip alışkanlığın var mı?',
      'Haber kaynağın ne?',
      'Günlük ne okursun?',
      'Hangi konularda haberdar olursun?',
      'Medya takibin nasıl?',
    ],
  },
  {
    options: ['Evet, severim', 'Bazen', 'Nadiren', 'Hiç sevmem'],
    questions: [
      'Sürpriz sever misin?',
      'Planlanmamış şeyler seni mutlu eder mi?',
      'Spontane planlar yapar mısın?',
      'Sürpriz hediye almayı sever misin?',
      'Ani değişikliklere nasıl tepki verirsin?',
    ],
  },
  {
    options: ['Lider', 'Takım oyuncusu', 'Bağımsız', 'Duruma göre'],
    questions: [
      'Grup içinde rolün ne olur?',
      'Ekip çalışmasında nasılsın?',
      'Projede hangi rolü alırsın?',
      'Sosyal ortamda nasıl davranırsın?',
      'Takımda kendini nasıl konumlandırırsın?',
    ],
  },
  {
    options: ['Evet, mutlaka', 'İmkân varsa', 'Nadiren', 'Hayır'],
    questions: [
      'Kahvaltı yapar mısın?',
      'Sabah rutinin nasıl?',
      'Kahvaltı önemli mi?',
      'Güne nasıl başlarsın?',
      'Sabah yemeği alışkanlığın var mı?',
    ],
  },
  {
    options: ['Doğa belgeseli', 'Dizi', 'YouTube', 'Film'],
    questions: [
      'TV\'de ne izlersin?',
      'Rahatlamak için ne izlersin?',
      'Boş akşamda ne açarsın?',
      'En çok ne tür içerik izlersin?',
      'Ekran karşısında ne tercih edersin?',
    ],
  },
  {
    options: ['Evet, çok', 'Biraz', 'Pek değil', 'Hiç'],
    questions: [
      'Mizah anlayışı önemli mi?',
      'Espri yapmayı sever misin?',
      'Gülmek senin için ne kadar önemli?',
      'Sohbette espri olsun ister misin?',
      'Mizah ilişkide önemli mi?',
    ],
  },
  {
    options: ['Açık havada', 'Kapalı mekânda', 'Evde', 'Fark etmez'],
    questions: [
      'Buluşma yeri tercihin?',
      'İlk randevuda nerede olmak istersin?',
      'Mekân tercihin nasıl?',
      'Tanışma ortamı nerede olsun?',
      'Buluşma mekânı önemli mi?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Erken kalkar mısın?',
      'Sabah insanı mısın?',
      'Erken yatıp erken kalkar mısın?',
      'Sabah enerjik misin?',
      'Güne erken başlamayı sever misin?',
    ],
  },
  {
    options: ['Seyahat', 'Ev', 'Yemek', 'Deneyim'],
    questions: [
      'Paranı en çok neye harcarsın?',
      'Bütçe önceliğin ne?',
      'Harcama tercihin ne?',
      'En çok neye yatırım yaparsın?',
      'Para harcarken önceliğin ne?',
    ],
  },
  {
    options: ['Evet, sık', 'Arada', 'Nadiren', 'Hiç'],
    questions: [
      'Arkadaşlarla buluşur musun?',
      'Sosyal buluşma sıklığın?',
      'Arkadaşlarla vakit geçirir misin?',
      'Sosyal aktivite yapar mısın?',
      'Arkadaş grubuyla ne sıklıkla görüşürsün?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Pek değil', 'Hayır'],
    questions: [
      'Romantik misin?',
      'Romantik jestler yapar mısın?',
      'İlişkide romantizm önemli mi?',
      'Sürpriz romantik anlar yaşar mısın?',
      'Romantik olmayı sever misin?',
    ],
  },
  {
    options: ['Şehir', 'Kasaba', 'Köy', 'Fark etmez'],
    questions: [
      'Yaşam yeri tercihin?',
      'Nerede yaşamak istersin?',
      'İdeal yaşam yeri neresi?',
      'Şehir mi kırsal mı?',
      'Yaşam alanı tercihin?',
    ],
  },
  {
    options: ['Evet, çok', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Fotoğraf çekmeyi sever misin?',
      'Anı ölümsüzleştirir misin?',
      'Selfie çeker misin?',
      'Fotoğrafçılık ilgi alanın mı?',
      'O anları kaydetmeyi sever misin?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Pek değil', 'Hayır'],
    questions: [
      'Rekabetçi misin?',
      'Yarışmalarda nasılsın?',
      'Kazanmak önemli mi?',
      'Rekabet seni motive eder mi?',
      'Oyunlarda rekabetçi misin?',
    ],
  },
  {
    options: ['Evet, her zaman', 'Çoğu zaman', 'Bazen', 'Hayır'],
    questions: [
      'Sözünde durur musun?',
      'Vaadlerini tutar mısın?',
      'Güvenilir misin?',
      'Söz vermek senin için ne ifade eder?',
      'Tutarlı mısın?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Nadiren', 'Hayır'],
    questions: [
      'Evcil hayvanla büyüdün mü?',
      'Çocukken hayvanın var mıydı?',
      'Hayvan sevgisi çocukluktan mı?',
      'Evcil hayvan deneyimin var mı?',
      'Küçükken hayvan besledin mi?',
    ],
  },
  {
    options: ['Klasik', 'Modern', 'Minimal', 'Renkli'],
    questions: [
      'Müzik tarzı tercihin?',
      'Ev dekorasyonu nasıl olsun?',
      'Giyim tarzın?',
      'Estetik tercihin?',
      'Tasarım anlayışın nasıl?',
    ],
  },
  {
    options: ['Evet, sık', 'Arada', 'Nadiren', 'Hiç'],
    questions: [
      'Kitap okur musun?',
      'Okuma alışkanlığın var mı?',
      'Ne sıklıkla kitap okursun?',
      'Kitap tercihin?',
      'Okumayı sever misin?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Pek değil', 'Hayır'],
    questions: [
      'Aile önemli mi?',
      'Aileyle vakit geçirir misin?',
      'Aile bağların güçlü mü?',
      'Aile toplantılarına katılır mısın?',
      'Aile senin için ne ifade eder?',
    ],
  },
  {
    options: ['Evet, çok', 'Biraz', 'Nadiren', 'Hayır'],
    questions: [
      'Yeni yerler keşfetmeyi sever misin?',
      'Seyahat etmeyi sever misin?',
      'Farklı kültürler ilgini çeker mi?',
      'Keşfetmek seni mutlu eder mi?',
      'Yeni şehirler görmek ister misin?',
    ],
  },
  {
    options: ['Sabah', 'Öğle', 'Akşam', 'Gece'],
    questions: [
      'Sporu ne zaman yaparsın?',
      'Egzersiz saatin?',
      'En enerjik olduğun saat?',
      'Çalışma saatin?',
      'Verimli olduğun saat?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Planlı mısın?',
      'Günlük plan yapar mısın?',
      'Organize misin?',
      'Planlı yaşamayı sever misin?',
      'Önceden plan yapar mısın?',
    ],
  },
  {
    options: ['Evet, hemen', 'Bir süre sonra', 'Zamanı gelince', 'Hayır'],
    questions: [
      'Ciddi ilişki ister misin?',
      'Uzun vadeli ilişki düşünür müsün?',
      'İlişki beklentin ne?',
      'Ciddi biri arıyor musun?',
      'İlişki hedefin ne?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Pek değil', 'Hayır'],
    questions: [
      'Dürüstlük önemli mi?',
      'Dürüst iletişim tercih eder misin?',
      'Yalan söylemek senin için kabul edilebilir mi?',
      'Açık iletişim kurar mısın?',
      'Dürüstlük ilişkide ne kadar önemli?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Evde yemek yapar mısın?',
      'Mutfakta zaman geçirir misin?',
      'Yemek yapmayı bilir misin?',
      'Ev yemekleri yapar mısın?',
      'Yemek pişirmeyi sever misin?',
    ],
  },
  {
    options: ['Evet, sık', 'Arada', 'Nadiren', 'Hiç'],
    questions: [
      'Konsere gider misin?',
      'Canlı müzik dinler misin?',
      'Etkinliklere katılır mısın?',
      'Konser deneyimin var mı?',
      'Müzik etkinliklerine gider misin?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Pek değil', 'Hayır'],
    questions: [
      'Sabırlı mısın?',
      'Beklemeyi bilir misin?',
      'Sabır senin için zor mu?',
      'Sabırlı olmayı başarır mısın?',
      'Zor durumlarda sabırlı mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Risk alır mısın?',
      'Konfor alanından çıkar mısın?',
      'Risk almaktan çekinir misin?',
      'Yeni deneyimlere açık mısın?',
      'Macera yaşar mısın?',
    ],
  },
  {
    options: ['Evet, çok', 'Biraz', 'Nadiren', 'Hayır'],
    questions: [
      'Sosyal misin?',
      'Yeni insanlarla tanışmayı sever misin?',
      'Kalabalık ortamları sever misin?',
      'Sosyal etkinliklere katılır mısın?',
      'İnsanlarla vakit geçirmeyi sever misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'İçe dönük müsün?',
      'Yalnız vakit geçirmeyi sever misin?',
      'Sessiz ortamları tercih eder misin?',
      'Kalabalıktan yorulur musun?',
      'Kendi başına vakit geçirmek seni dinlendirir mi?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Pek değil', 'Hayır'],
    questions: [
      'Optimist misin?',
      'Pozitif düşünür müsün?',
      'Glass half full misin?',
      'Olumlu bakmayı sever misin?',
      'Pesimist mi optimist misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Duygusal mısın?',
      'Duygularını ifade eder misin?',
      'Duygusal filmlerden etkilenir misin?',
      'Duygusal anlar yaşar mısın?',
      'Duygularına göre hareket eder misin?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Nadiren', 'Hayır'],
    questions: [
      'Mantıklı mısın?',
      'Kararlarında mantık mı duygu mu?',
      'Analitik düşünür müsün?',
      'Mantıklı karar verir misin?',
      'Duygu mu mantık mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Yaratıcı mısın?',
      'Sanatla ilgilenir misin?',
      'Yaratıcı projeler yapar mısın?',
      'El işi yapar mısın?',
      'Yaratıcılık senin için önemli mi?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Nadiren', 'Hayır'],
    questions: [
      'Sportif misin?',
      'Sporla aran nasıl?',
      'Aktif yaşam tarzın var mı?',
      'Spor yapmayı sever misin?',
      'Fiziksel aktivite hayatında var mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Doğasever misin?',
      'Doğada vakit geçirmeyi sever misin?',
      'Kamp yapar mısın?',
      'Doğa yürüyüşü yapar mısın?',
      'Doğayla iç içe misin?',
    ],
  },
  {
    options: ['Evet', 'Biraz', 'Nadiren', 'Hayır'],
    questions: [
      'Teknoloji meraklısı mısın?',
      'Yeni teknolojileri takip eder misin?',
      'Teknoloji ürünleri ilgini çeker mi?',
      'Teknoloji kullanımın nasıl?',
      'Teknoloji hayatında ne kadar yer kaplıyor?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Felsefe ilgini çeker mi?',
      'Derin sohbetler sever misin?',
      'Hayatın anlamı üzerine düşünür müsün?',
      'Felsefi konular ilgini çeker mi?',
      'Varoluşsal konularda sohbet eder misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Gündem takip eder misin?',
      'Haber okur musun?',
      'Günlük olaylardan haberdar mısın?',
      'Haber kaynağın var mı?',
      'Dünya gündemini takip eder misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Spor takip eder misin?',
      'Maç izler misin?',
      'Takım tutar mısın?',
      'Spor haberleri okur musun?',
      'Spor senin için önemli mi?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sinema sever misin?',
      'Sinemaya sık gider misin?',
      'Film önerisi ister misin?',
      'Sinema kültürün var mı?',
      'Film izlemeyi sever misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Dizi takip eder misin?',
      'Binge watch yapar mısın?',
      'Dizi önerisi verir misin?',
      'Dizi izlemeyi sever misin?',
      'Takip ettiğin dizi var mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Oyun oynar mısın?',
      'Video oyunları ilgini çeker mi?',
      'Oyun konsolu/PC oyunun var mı?',
      'Oyun oynamayı sever misin?',
      'Boş zamanında oyun oynar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Yemek yapmayı sever misin?',
      'Mutfakta vakit geçirir misin?',
      'Tarif dener misin?',
      'Yemek pişirmek senin için keyif mi?',
      'Ev yemekleri yapar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Kahve kültürü önemli mi?',
      'Kahve deneyimi yaşar mısın?',
      'Kahve çeşitleri bilir misin?',
      'Kahve senin için ne ifade eder?',
      'Kahve keyfi yapar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Alkol tüketir misin?',
      'Sosyal ortamda içki içer misin?',
      'İçki tercihin var mı?',
      'Alkol hayatında var mı?',
      'İçki konusunda nasılsın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sigara kullanır mısın?',
      'Sigara konusunda nasılsın?',
      'Sigara içer misin?',
      'Sigara alışkanlığın var mı?',
      'Sigara tercihin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Ev partisi verir misin?',
      'Evde misafir ağırlar mısın?',
      'Ev partisi sever misin?',
      'Arkadaşları evde toplar mısın?',
      'Evde eğlence düzenler misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Gece hayatına çıkar mısın?',
      'Bara/clube gider misin?',
      'Gece eğlencesi sever misin?',
      'Gece hayatı senin için var mı?',
      'Gece dışarı çıkar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sakin ortamları sever misin?',
      'Sessiz mekânları tercih eder misin?',
      'Gürültüden rahatsız olur musun?',
      'Sakin yaşam tarzı senin için mi?',
      'Huzurlu ortamları sever misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Kalabalık ortamları sever misin?',
      'Parti ortamı seni mutlu eder mi?',
      'Kalabalıkta enerji alır mısın?',
      'Sosyal ortamlarda nasılsın?',
      'Kalabalık seni yorar mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Hediye almayı sever misin?',
      'Hediye seçerken özen gösterir misin?',
      'Özel günlerde hediye verir misin?',
      'Hediye vermek senin için önemli mi?',
      'Hediye alışverişi yapar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sürpriz hediye alır mısın?',
      'Sürpriz yapmayı sever misin?',
      'Sürpriz planlar yapar mısın?',
      'Sürpriz seni mutlu eder mi?',
      'Ani sürprizler nasıl?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Uzun mesaj yazar mısın?',
      'Detaylı anlatır mısın?',
      'Mesajlarda uzun yazar mısın?',
      'Sohbette detay verir misin?',
      'Uzun yazışma tarzın var mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Kısa ve öz yazar mısın?',
      'Mesajlarda kısa mısın?',
      'Öz iletişim tercih eder misin?',
      'Kısa cevaplar verir misin?',
      'Yazışmada kısa mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Görüntülü arama yapar mısın?',
      'Video call tercih eder misin?',
      'Yüz yüze görüntülü konuşur musun?',
      'Görüntülü sohbet kullanır mısın?',
      'Video arama senin için normal mi?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sesli mesaj atar mısın?',
      'Sesli mesaj dinler misin?',
      'Sesli iletişim tercih eder misin?',
      'Voice note kullanır mısın?',
      'Sesli mesaj alışkanlığın var mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sticker kullanır mısın?',
      'Mesajlarda sticker atar mısın?',
      'Sticker koleksiyonun var mı?',
      'Sticker kullanmayı sever misin?',
      'Sohbette sticker tercih eder misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'GIF kullanır mısın?',
      'GIF ile cevap verir misin?',
      'GIF göndermeyi sever misin?',
      'GIF kullanımın var mı?',
      'Mesajlarda GIF atar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'İlk mesajı sen atar mısın?',
      'Tanışmada ilk adımı sen atar mısın?',
      'Önce sen yazar mısın?',
      'İlk teması sen kurar mısın?',
      'İlk mesajda sen mi atarsın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Karşı tarafın yazmasını bekler misin?',
      'Önce onun yazmasını ister misin?',
      'Beklemeyi tercih eder misin?',
      'İlk mesajı o atsın ister misin?',
      'Karşı taraftan ilk mesaj bekler misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sohbeti sen mi kapatırsın?',
      'Son mesajı sen mi atarsın?',
      'Sohbet bitişini sen mi yönetirsin?',
      'Gecelik son mesajı sen atar mısın?',
      'Sohbet kapanışında nasılsın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Read receipt açık mı?',
      'Okundu bilgisi kullanır mısın?',
      'Mesaj okundu mu takip eder misin?',
      'Okundu bilgisi önemli mi?',
      'Read receipt senin için var mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Online durumunu gizler misin?',
      'Görünmez mod kullanır mısın?',
      'Online olma bilgisini paylaşır mısın?',
      'Son görülme açık mı?',
      'Online durumu senin için özel mi?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Profil fotoğrafına özen gösterir misin?',
      'Profil resmi seçerken dikkat eder misin?',
      'Profil fotoğrafı önemli mi?',
      'Profil görseli senin için ne ifade eder?',
      'Profil fotoğrafı günceller misin?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Bio yazmayı sever misin?',
      'Profil açıklaması yazar mısın?',
      'Kendini kısa anlatır mısın?',
      'Bio önemli mi?',
      'Profil metni yazar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Çok mesajlaşır mısın?',
      'Gün boyu yazışır mısın?',
      'Sürekli mesajlaşma tarzın var mı?',
      'Yoğun yazışma yapar mısın?',
      'Mesaj trafiğin yoğun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Ara ara yazışmayı tercih eder misin?',
      'Mesajlara ara ara mı cevap verirsin?',
      'Yoğun sohbet yerine arada yazışma mı?',
      'Sohbet sıklığında nasılsın?',
      'Ara ara mesaj atar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sabah mesajı atar mısın?',
      'Günaydın mesajı yazar mısın?',
      'Sabah ilk mesajı sen atar mısın?',
      'Sabah selamı verir misin?',
      'Sabah mesajlaşması yapar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'İyi geceler mesajı atar mısın?',
      'Gece son mesajı sen atar mısın?',
      'İyi geceler yazar mısın?',
      'Gecelik kapanış mesajı atar mısın?',
      'Gece mesajlaşması nasıl biter?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Politika konuşur musun?',
      'Siyaset sohbeti yapar mısın?',
      'Politik görüş paylaşır mısın?',
      'Politika ilişkide konuşulur mu?',
      'Siyaset sohbeti senin için uygun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Din konuşur musun?',
      'İnanç sohbeti yapar mısın?',
      'Din hayatında ne kadar yer kaplıyor?',
      'İnanç konusu açılır mı?',
      'Din sohbeti senin için uygun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'İş hakkında konuşur musun?',
      'Kariyer sohbeti yapar mısın?',
      'İş hayatından bahseder misin?',
      'İş konusu açılır mı?',
      'Kariyer konuşması yapar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Gelecek planları konuşur musun?',
      'Hedeflerinden bahseder misin?',
      'Gelecek planı sohbeti yapar mısın?',
      'Uzun vadeli planlar konuşulur mu?',
      'Gelecek konuşması yapar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Gündem haberleri paylaşır mısın?',
      'Haber sohbeti yapar mısın?',
      'Gündem konuşur musun?',
      'Haber paylaşır mısın?',
      'Günlük olaylar konuşulur mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Spor haberleri konuşur musun?',
      'Maç sohbeti yapar mısın?',
      'Spor gündemi takip eder misin?',
      'Spor konuşması yapar mısın?',
      'Spor sohbeti senin için var mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Teknoloji haberleri takip eder misin?',
      'Tech sohbeti yapar mısın?',
      'Yazılım/teknoloji konuşur musun?',
      'Teknoloji gündemi takip eder misin?',
      'Tech konuşması yapar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sanat konuşur musun?',
      'Sanat sohbeti yapar mısın?',
      'Sanat ilgini çeker mi?',
      'Sanat konusu açılır mı?',
      'Sanat sohbeti senin için uygun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Bilim konuşur musun?',
      'Bilim sohbeti yapar mısın?',
      'Bilim ilgini çeker mi?',
      'Bilim konusu açılır mı?',
      'Bilim sohbeti senin için uygun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Psikoloji konuşur musun?',
      'Psikoloji sohbeti yapar mısın?',
      'İnsan davranışı ilgini çeker mi?',
      'Psikoloji konusu açılır mı?',
      'Psikoloji sohbeti senin için uygun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Müzik sohbeti yapar mısın?',
      'Müzik konuşur musun?',
      'Müzik türleri konuşulur mu?',
      'Müzik paylaşır mısın?',
      'Müzik sohbeti senin için var mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Film/dizi önerisi verir misin?',
      'Film sohbeti yapar mısın?',
      'Dizi konuşur musun?',
      'Film önerisi ister misin?',
      'Film/dizi sohbeti yapar mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Kitap önerisi verir misin?',
      'Kitap sohbeti yapar mısın?',
      'Okuma listesi paylaşır mısın?',
      'Kitap konuşur musun?',
      'Kitap sohbeti senin için var mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Seyahat deneyimi paylaşır mısın?',
      'Seyahat sohbeti yapar mısın?',
      'Gezi anıları anlatır mısın?',
      'Seyahat konuşur musun?',
      'Seyahat sohbeti senin için uygun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Yemek tarifi paylaşır mısın?',
      'Yemek sohbeti yapar mısın?',
      'Tarif konuşur musun?',
      'Yemek önerisi verir misin?',
      'Yemek sohbeti senin için var mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Meme paylaşır mısın?',
      'Komik içerik paylaşır mısın?',
      'Meme sohbeti yapar mısın?',
      'Komik paylaşım yapar mısın?',
      'Meme sohbeti senin için uygun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Hayal kurar mısın?',
      'Hayallerinden bahseder misin?',
      'Hayal sohbeti yapar mısın?',
      'Hayal kurmayı sever misin?',
      'Hayaller konuşulur mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Geçmişten bahseder misin?',
      'Anı paylaşır mısın?',
      'Geçmiş sohbeti yapar mısın?',
      'Çocukluk anıları anlatır mısın?',
      'Geçmiş konuşulur mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Günlük rutininden bahseder misin?',
      'Rutin sohbeti yapar mısın?',
      'Günlük hayatından bahseder misin?',
      'Rutin paylaşır mısın?',
      'Günlük rutin konuşulur mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Rüyalarından bahseder misin?',
      'Rüya sohbeti yapar mısın?',
      'Rüya paylaşır mısın?',
      'Rüyalar konuşulur mu?',
      'Rüya anlatır mısın?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Fobilerinden bahseder misin?',
      'Korku sohbeti yapar mısın?',
      'Korkularını paylaşır mısın?',
      'Fobi konuşulur mu?',
      'Korku konusu açılır mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Hobilerinden bahseder misin?',
      'Hobi sohbeti yapar mısın?',
      'Hobi paylaşır mısın?',
      'Hobiler konuşulur mu?',
      'Hobi konusu açılır mı?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Aile planları konuşur musun?',
      'Aile sohbeti yapar mısın?',
      'Çocuk/evlilik planı konuşulur mu?',
      'Aile planı paylaşır mısın?',
      'Aile planları senin için konuşulur mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Kariyer hedeflerinden bahseder misin?',
      'Kariyer sohbeti yapar mısın?',
      'İş hedefleri konuşulur mu?',
      'Kariyer planı paylaşır mısın?',
      'Kariyer hedefleri konuşulur mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Para konusu konuşulur mu?',
      'Finans sohbeti yapar mısın?',
      'Para konuşur musun?',
      'Finansal konular açılır mı?',
      'Para konusu senin için uygun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Sağlık konuşur musun?',
      'Sağlık sohbeti yapar mısın?',
      'Sağlık konusu açılır mı?',
      'Sağlık paylaşır mısın?',
      'Sağlık sohbeti senin için uygun mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Mod konuşur musun?',
      'Duygu durumu paylaşır mısın?',
      'Nasıl hissettiğini söyler misin?',
      'Mod sohbeti yapar mısın?',
      'Duygu durumu konuşulur mu?',
    ],
  },
  {
    options: ['Evet', 'Bazen', 'Nadiren', 'Hayır'],
    questions: [
      'Günlük olayları paylaşır mısın?',
      'Gün sohbeti yapar mısın?',
      'Bugün ne yaptın konuşulur mu?',
      'Günlük paylaşım yapar mısın?',
      'Günlük olaylar konuşulur mu?',
    ],
  },
];

/** 500 soru: her şablondan 5 soru metni; toplam 500'e kesilir. Her soru 4 seçenek. */
function buildQuestions(): { questionText: string; options: [string, string, string, string] }[] {
  const out: { questionText: string; options: [string, string, string, string] }[] = [];
  for (const t of TEMPLATES) {
    for (const q of t.questions) {
      out.push({ questionText: q, options: t.options });
    }
  }
  return out.slice(0, 500);
}

export const QUESTIONS = buildQuestions();
