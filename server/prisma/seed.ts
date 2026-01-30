import { PrismaClient, CardCategory, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed admin user
  const adminEmail = 'admin@cardmatch.com';
  const adminPassword = 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
    },
  });

  // Seed 60 Turkish anti-small-talk cards
  const cards = [
    // LIFESTYLE (15)
    {
      questionTR: 'Sabah kahvaltısında ne olmalı?',
      category: CardCategory.LIFESTYLE,
      options: ['Tuzlu', 'Tatlı', 'Her ikisi', 'Kahvaltı yapmam'],
    },
    {
      questionTR: 'Tatil tercihin?',
      category: CardCategory.LIFESTYLE,
      options: ['Deniz', 'Dağ', 'Şehir turu', 'Evde dinlenmek'],
    },
    {
      questionTR: 'Hafta sonu planın?',
      category: CardCategory.LIFESTYLE,
      options: ['Dışarıda', 'Evde', 'Spor', 'Arkadaşlarla'],
    },
    {
      questionTR: 'Güne başlama ritüelin?',
      category: CardCategory.LIFESTYLE,
      options: ['Kahve', 'Duş', 'Sosyal medya', 'Alarmı ertelerim'],
    },
    {
      questionTR: 'Uyku düzenin nasıl?',
      category: CardCategory.LIFESTYLE,
      options: ['Erken yatarım', 'Geç yatarım', 'Düzensiz', 'Değişken'],
    },
    {
      questionTR: 'Sporla aran nasıl?',
      category: CardCategory.LIFESTYLE,
      options: ['Düzenli yaparım', 'Ara sıra', 'Seyirciyim', 'Hiç sevmem'],
    },
    {
      questionTR: 'Alışveriş tarzın?',
      category: CardCategory.LIFESTYLE,
      options: ['Planlı', 'Spontane', 'İndirim beklerim', 'İhtiyaç oldukça'],
    },
    {
      questionTR: 'Yemek yapma becerin?',
      category: CardCategory.LIFESTYLE,
      options: ['Şef gibiyim', 'İdare eder', 'Menemen bile zor', 'Dışarıdan söylerim'],
    },
    {
      questionTR: 'Ev düzenin nasıldır?',
      category: CardCategory.LIFESTYLE,
      options: ['Tertemiz', 'Dağınık ama temiz', 'Kreatif kaos', 'Hiç sorma'],
    },
    {
      questionTR: 'Toplu taşımaya bakışın?',
      category: CardCategory.LIFESTYLE,
      options: ['Sık kullanırım', 'Mecbur kalınca', 'Mümkünse taksi', 'Arabasız asla'],
    },
    {
      questionTR: 'Kahve tercihlerin?',
      category: CardCategory.LIFESTYLE,
      options: ['Sade/Türk kahvesi', 'Latte/Cappuccino', 'Filtre kahve', 'Kahve içmem'],
    },
    {
      questionTR: 'Gece hayatı senin için?',
      category: CardCategory.LIFESTYLE,
      options: ['Vazgeçilmez', 'Ara sıra', 'Nadiren', 'Hiç sevmem'],
    },
    {
      questionTR: 'Çalışma stilin?',
      category: CardCategory.LIFESTYLE,
      options: ['Erken kalkan', 'Gece çalışan', 'Son dakikacı', 'Düzenli ve planlı'],
    },
    {
      questionTR: 'Tek başına vakit geçirme?',
      category: CardCategory.LIFESTYLE,
      options: ['Çok severim', 'Dengeli olmalı', 'Pek sevmem', 'Asla yalnız kalmam'],
    },
    {
      questionTR: 'Telefon kullanımın?',
      category: CardCategory.LIFESTYLE,
      options: ['Sürekli elimde', 'İş için daha çok', 'Sosyal medya ağırlıklı', 'Mecbur kalınca'],
    },

    // VALUES (15)
    {
      questionTR: 'İlişkide en önemli?',
      category: CardCategory.VALUES,
      options: ['Güven', 'Sadakat', 'İletişim', 'Heyecan'],
    },
    {
      questionTR: 'Kendi mutluluğun mu önemli?',
      category: CardCategory.VALUES,
      options: ['Tabii ki', 'Başkalarının mutluluğu da önemli', 'Dengeli olmalı', 'Başkaları önce'],
    },
    {
      questionTR: 'Para senin için?',
      category: CardCategory.VALUES,
      options: ['Güvenlik', 'Özgürlük', 'Araç', 'Önemli değil'],
    },
    {
      questionTR: 'Aile ile ilişkiler?',
      category: CardCategory.VALUES,
      options: ['Çok yakınım', 'Dengeli', 'Mesafeli', 'Karmaşık'],
    },
    {
      questionTR: 'Kariyer mi, aşk mı?',
      category: CardCategory.VALUES,
      options: ['Kariyer', 'Aşk', 'Denge', 'Döneme göre değişir'],
    },
    {
      questionTR: 'Evlilik hakkında ne düşünüyorsun?',
      category: CardCategory.VALUES,
      options: ['Kesin isterim', 'Olursa olur', 'Kararsızım', 'İstemiyorum'],
    },
    {
      questionTR: 'Çocuk sahibi olmak?',
      category: CardCategory.VALUES,
      options: ['Kesin isterim', 'Belki ileride', 'Kararsızım', 'İstemiyorum'],
    },
    {
      questionTR: 'Dürüstlük anlayışın?',
      category: CardCategory.VALUES,
      options: ['Her zaman tam dürüstlük', 'Beyaz yalan olabilir', 'Duruma göre', 'Bazen gizlemek daha iyi'],
    },
    {
      questionTR: 'Fedakarlık sınırın?',
      category: CardCategory.VALUES,
      options: ['Kendimden vazgeçerim', 'Dengeli olmalı', 'Sınırlarım net', 'Minimum fedakarlık'],
    },
    {
      questionTR: 'İlişkide kıskançlık?',
      category: CardCategory.VALUES,
      options: ['Olmalı, dozunda', 'Hiç sevmem', 'Biraz tatlıdır', 'Beni boğar'],
    },
    {
      questionTR: 'Bağımsızlık senin için?',
      category: CardCategory.VALUES,
      options: ['Olmazsa olmaz', 'İlişkide paylaşılır', 'Çok önemli değil', 'Partner odaklıyım'],
    },
    {
      questionTR: 'Gelecek planların?',
      category: CardCategory.VALUES,
      options: ['Net planlarım var', 'Kafamda bir taslak var', 'Akışa bırakıyorum', 'Hiç düşünmedim'],
    },
    {
      questionTR: 'Sadakat tanımın?',
      category: CardCategory.VALUES,
      options: ['Söz, davranış, düşünce', 'Davranış önemli', 'Sınırlar konuşulur', 'Göreceli'],
    },
    {
      questionTR: 'İlişkide roller?',
      category: CardCategory.VALUES,
      options: ['Geleneksel', 'Eşitlikçi', 'Duruma göre', 'Hiç düşünmedim'],
    },
    {
      questionTR: 'Kriz anında tavrın?',
      category: CardCategory.VALUES,
      options: ['Sakin kalırım', 'Duygusal tepki veririm', 'İçe kapanırım', 'Kaçmayı tercih ederim'],
    },

    // INTERESTS (15)
    {
      questionTR: 'Film türü?',
      category: CardCategory.INTERESTS,
      options: ['Komedi', 'Aksiyon', 'Romantik', 'Korku'],
    },
    {
      questionTR: 'Müzik tarzın?',
      category: CardCategory.INTERESTS,
      options: ['Pop', 'Rock', 'Rap', 'Klasik'],
    },
    {
      questionTR: 'Kitap tercihlerin?',
      category: CardCategory.INTERESTS,
      options: ['Kurgu', 'Kişisel gelişim', 'Tarih', 'Pek okumam'],
    },
    {
      questionTR: 'Oyunlarla aran?',
      category: CardCategory.INTERESTS,
      options: ['Bilgisayar/Console', 'Masa oyunları', 'Mobil oyunlar', 'Oyun oynamam'],
    },
    {
      questionTR: 'Seyahat tarzın?',
      category: CardCategory.INTERESTS,
      options: ['Backpacker', 'Konforlu otel', 'Aile yanında', 'Evde kalırım'],
    },
    {
      questionTR: 'Sanatla ilişkin?',
      category: CardCategory.INTERESTS,
      options: ['Aktif ilgilenirim', 'Takip ederim', 'Ara sıra', 'Pek yok'],
    },
    {
      questionTR: 'Dizi izleme alışkanlığın?',
      category: CardCategory.INTERESTS,
      options: ['Binge-watcher', 'Haftalık takip', 'Nadiren', 'Hiç'],
    },
    {
      questionTR: 'Sosyal medya kullanımın?',
      category: CardCategory.INTERESTS,
      options: ['Çok aktif', 'Orta düzey', 'Az kullanırım', 'Hiç kullanmam'],
    },
    {
      questionTR: 'En çok keyif aldığın aktivite?',
      category: CardCategory.INTERESTS,
      options: ['Dışarıda sosyalleşmek', 'Evde film/dizi', 'Doğa yürüyüşü', 'Yaratıcı hobiler'],
    },
    {
      questionTR: 'Takım sporlarıyla aran?',
      category: CardCategory.INTERESTS,
      options: ['Oynamayı severim', 'Seyretmeyi severim', 'Ara sıra', 'Hiç ilgi duymam'],
    },
    {
      questionTR: 'Podcast dinler misin?',
      category: CardCategory.INTERESTS,
      options: ['Sık sık', 'Ara sıra', 'Nadiren', 'Hiç'],
    },
    {
      questionTR: 'Teknolojiye bakışın?',
      category: CardCategory.INTERESTS,
      options: ['Erken benimseyen', 'Takip ederim', 'Gerektiği kadar', 'Mecbur kalınca'],
    },
    {
      questionTR: 'Evcil hayvanlarla aran?',
      category: CardCategory.INTERESTS,
      options: ['Bayılırım', 'Severim ama bakamam', 'Mesafeliyim', 'Sevmem'],
    },
    {
      questionTR: 'Hafta içi akşamları genelde?',
      category: CardCategory.INTERESTS,
      options: ['Dışarıda', 'Evde dinlenme', 'Ek iş/üretim', 'Aile/arkadaş ziyareti'],
    },
    {
      questionTR: 'Hafta sonu kaçamak planın?',
      category: CardCategory.INTERESTS,
      options: ['Yakın şehir gezisi', 'Doğa kaçamağı', 'Evde kalmak', 'Arkadaşlarla plan'],
    },

    // PERSONALITY (10)
    {
      questionTR: 'Kendini nasıl tanımlarsın?',
      category: CardCategory.PERSONALITY,
      options: ['İçe dönük', 'Dışa dönük', 'Ortada', 'Duruma göre'],
    },
    {
      questionTR: 'Karar verme stilin?',
      category: CardCategory.PERSONALITY,
      options: ['Hızlı karar alırım', 'Uzun uzun düşünürüm', 'İçgüdülerime güvenirim', 'Başkalarına sorarım'],
    },
    {
      questionTR: 'Stresle başa çıkma yöntemlerin?',
      category: CardCategory.PERSONALITY,
      options: ['Spor', 'Yalnız kalmak', 'Arkadaşlarla konuşmak', 'Ertelemek'],
    },
    {
      questionTR: 'Planlı mısın, spontan mı?',
      category: CardCategory.PERSONALITY,
      options: ['Çok planlı', 'Genelde planlı', 'Spontan', 'Tamamen akışına bırakırım'],
    },
    {
      questionTR: 'İlk tanışmada nasılsın?',
      category: CardCategory.PERSONALITY,
      options: ['Çok sosyal', 'Biraz çekingen', 'İzlerim sonra açılırım', 'Duruma göre değişir'],
    },
    {
      questionTR: 'Tartışma anında tavrın?',
      category: CardCategory.PERSONALITY,
      options: ['Hemen konuşmak isterim', 'Sakinleşip sonra konuşurum', 'İçe kapanırım', 'Konuyu kapatırım'],
    },
    {
      questionTR: 'Romantiklik seviyen?',
      category: CardCategory.PERSONALITY,
      options: ['Aşırı romantik', 'Dengeli', 'Nadiren', 'Hiç değilim'],
    },
    {
      questionTR: 'Risk almaya bakışın?',
      category: CardCategory.PERSONALITY,
      options: ['Risk almadan olmaz', 'Hesaplı risk', 'Güvenli bölge', 'Riskten kaçarım'],
    },
    {
      questionTR: 'Sabır seviyen?',
      category: CardCategory.PERSONALITY,
      options: ['Çok sabırlıyım', 'Genelde sabırlıyım', 'Çabuk sıkılırım', 'Hiç sabrım yok'],
    },
    {
      questionTR: 'Empati yeteneğin?',
      category: CardCategory.PERSONALITY,
      options: ['Çok yüksek', 'Dengeli', 'Duruma göre', 'Zorlanırım'],
    },

    // HUMOR (5)
    {
      questionTR: 'Mizah anlayışın?',
      category: CardCategory.HUMOR,
      options: ['Kara mizah', 'Absürt', 'Kelime oyunları', 'Fiziksel komedi'],
    },
    {
      questionTR: 'En çok neye gülersin?',
      category: CardCategory.HUMOR,
      options: ['Günlük hayat saçmalıkları', 'Stand-up', 'Arkadaş esprileri', 'Kedi/köpek videoları'],
    },
    {
      questionTR: 'Espri yapma stilin?',
      category: CardCategory.HUMOR,
      options: ['Sürekli espri', 'Doğru zamanda', 'Nadiren', 'Dinlemeyi severim'],
    },
    {
      questionTR: 'Komik bulmadığın mizah?',
      category: CardCategory.HUMOR,
      options: ['Aşağılama içeren', 'Kaba küfürlü', 'Çok karanlık', 'Hiç fark etmez'],
    },
    {
      questionTR: 'Beraber gülebilmek senin için?',
      category: CardCategory.HUMOR,
      options: ['Çok önemli', 'Güzel olur', 'Olmasa da olur', 'Önemli değil'],
    },
  ];

  await prisma.card.deleteMany();
  await prisma.card.createMany({
    data: cards.map((c) => ({
      questionTR: c.questionTR,
      category: c.category,
      optionsJson: JSON.stringify(c.options),
    })),
  });

  // Seed 10 test users (with full profile)
  // İlk 5 kullanıcı: 500 token + Prime özellikli
  // Son 5 kullanıcı: 100 token (normal kullanıcı)
  const testUsers = [
    { nickname: 'testuser1', age: 25, gender: 'MALE', city: 'Istanbul', lat: 41.0082, lon: 28.9784, isPrime: true },
    { nickname: 'testuser2', age: 27, gender: 'FEMALE', city: 'Ankara', lat: 39.9334, lon: 32.8597, isPrime: true },
    { nickname: 'testuser3', age: 30, gender: 'MALE', city: 'Izmir', lat: 38.4237, lon: 27.1428, isPrime: true },
    { nickname: 'testuser4', age: 23, gender: 'FEMALE', city: 'Antalya', lat: 36.8969, lon: 30.7133, isPrime: true },
    { nickname: 'testuser5', age: 28, gender: 'MALE', city: 'Bursa', lat: 40.1885, lon: 29.0610, isPrime: true },
    { nickname: 'testuser6', age: 26, gender: 'FEMALE', city: 'Istanbul', lat: 41.0351, lon: 28.9833, isPrime: false },
    { nickname: 'testuser7', age: 29, gender: 'MALE', city: 'Ankara', lat: 39.9208, lon: 32.8541, isPrime: false },
    { nickname: 'testuser8', age: 24, gender: 'FEMALE', city: 'Izmir', lat: 38.4189, lon: 27.1287, isPrime: false },
    { nickname: 'testuser9', age: 31, gender: 'MALE', city: 'Antalya', lat: 36.8841, lon: 30.7056, isPrime: false },
    { nickname: 'testuser10', age: 22, gender: 'FEMALE', city: 'Bursa', lat: 40.1826, lon: 29.0665, isPrime: false },
  ];

  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    const tokenBalance = i < 5 ? 500 : 100; // İlk 5: 500, Son 5: 100 token
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - user.age); // Yaşa göre doğum tarihi

    await prisma.user.upsert({
      where: { phoneNumber: `+90000000000${i + 1}` },
      update: {
        tokenBalance,
        birthDate,
        latitude: user.lat,
        longitude: user.lon,
        isPrime: user.isPrime,
        primeExpiry: user.isPrime ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null, // 1 yıllık Prime
        filterMinAge: 18,
        filterMaxAge: 99,
        filterMaxDistance: 160,
        monthlySparksEarned: 0,
        totalSparksEarned: 0,
        dailyChatsStarted: 0,
      },
      create: {
        phoneNumber: `+90000000000${i + 1}`,
        nickname: user.nickname,
        age: user.age,
        birthDate,
        gender: user.gender as 'MALE' | 'FEMALE',
        interestedIn: 'BOTH',
        bio: `Merhaba, ben ${user.nickname}! ${user.city}'den selamlar.`,
        city: user.city,
        country: 'TR',
        latitude: user.lat,
        longitude: user.lon,
        verified: true,
        verificationStatus: 'APPROVED',
        tokenBalance,
        isPrime: user.isPrime,
        primeExpiry: user.isPrime ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
        filterMinAge: 18,
        filterMaxAge: 99,
        filterMaxDistance: 160,
        monthlySparksEarned: 0,
        totalSparksEarned: 0,
        dailyChatsStarted: 0,
      },
    });
    console.log(`User ${user.nickname}: ${tokenBalance} token, ${user.city}, ${user.isPrime ? '👑 PRIME' : 'Normal'}`);
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

