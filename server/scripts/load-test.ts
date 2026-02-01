/**
 * CardMatch Yük Testi Scripti
 * 
 * Bu script, belirtilen sayıda sanal kullanıcı ile sunucuya bağlanarak
 * sistemin performansını test eder.
 * 
 * Kullanım:
 *   npx ts-node scripts/load-test.ts [kullanıcı_sayısı] [sunucu_url]
 * 
 * Örnek:
 *   npx ts-node scripts/load-test.ts 100 http://localhost:3000
 *   npx ts-node scripts/load-test.ts 1000 http://localhost:3000
 * 
 * NOT: 10.000 kullanıcı testi için güçlü bir makine ve
 * production benzeri ortam gerekir.
 */

import { io, Socket } from 'socket.io-client';

// Konfigürasyon
const DEFAULT_USERS = 100;
const DEFAULT_URL = 'http://localhost:3000';
const BATCH_SIZE = 50; // Aynı anda kaç bağlantı açılacak
const BATCH_DELAY = 500; // Batch'ler arası bekleme (ms)

// İstatistikler
interface Stats {
  connected: number;
  failed: number;
  matchJoined: number;
  matchFound: number;
  errors: string[];
  connectionTimes: number[];
}

const stats: Stats = {
  connected: 0,
  failed: 0,
  matchJoined: 0,
  matchFound: 0,
  errors: [],
  connectionTimes: [],
};

const sockets: Socket[] = [];

// Rastgele kullanıcı ID'si oluştur
function generateUserId(): string {
  return `test-user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Tek bir kullanıcı bağlantısı oluştur
async function createConnection(serverUrl: string, index: number): Promise<Socket | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const userId = generateUserId();
    
    const socket = io(serverUrl, {
      transports: ['websocket'],
      timeout: 10000,
      reconnection: false,
      auth: {
        testMode: true,
        userId,
      },
    });

    const timeout = setTimeout(() => {
      socket.close();
      stats.failed++;
      stats.errors.push(`User ${index}: Connection timeout`);
      resolve(null);
    }, 15000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      const connectionTime = Date.now() - startTime;
      stats.connected++;
      stats.connectionTimes.push(connectionTime);
      
      // Eşleşme kuyruğuna katıl
      socket.emit('match:join', { userId });
      stats.matchJoined++;
      
      resolve(socket);
    });

    socket.on('match:found', (payload) => {
      stats.matchFound++;
      console.log(`✓ User ${index}: Match found!`);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      stats.failed++;
      stats.errors.push(`User ${index}: ${error.message}`);
      resolve(null);
    });

    socket.on('error', (error) => {
      stats.errors.push(`User ${index}: Socket error - ${error}`);
    });
  });
}

// Batch halinde bağlantılar oluştur
async function createBatch(serverUrl: string, startIndex: number, count: number): Promise<void> {
  const promises: Promise<Socket | null>[] = [];
  
  for (let i = 0; i < count; i++) {
    promises.push(createConnection(serverUrl, startIndex + i));
  }
  
  const results = await Promise.all(promises);
  results.forEach(socket => {
    if (socket) sockets.push(socket);
  });
}

// İstatistikleri yazdır
function printStats(): void {
  const avgConnectionTime = stats.connectionTimes.length > 0
    ? Math.round(stats.connectionTimes.reduce((a, b) => a + b, 0) / stats.connectionTimes.length)
    : 0;
  
  const minConnectionTime = stats.connectionTimes.length > 0
    ? Math.min(...stats.connectionTimes)
    : 0;
  
  const maxConnectionTime = stats.connectionTimes.length > 0
    ? Math.max(...stats.connectionTimes)
    : 0;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('                  📊 YÜK TESTİ SONUÇLARI                 ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ Başarılı Bağlantı:     ${stats.connected}`);
  console.log(`  ❌ Başarısız Bağlantı:    ${stats.failed}`);
  console.log(`  🎯 Kuyruğa Katılan:       ${stats.matchJoined}`);
  console.log(`  💕 Eşleşme Bulunan:       ${stats.matchFound}`);
  console.log('───────────────────────────────────────────────────────');
  console.log(`  ⏱️  Ortalama Bağlantı:     ${avgConnectionTime}ms`);
  console.log(`  ⚡ Min Bağlantı:          ${minConnectionTime}ms`);
  console.log(`  🐢 Max Bağlantı:          ${maxConnectionTime}ms`);
  console.log('═══════════════════════════════════════════════════════');
  
  if (stats.errors.length > 0) {
    console.log('\n📋 İlk 10 Hata:');
    stats.errors.slice(0, 10).forEach(err => console.log(`  • ${err}`));
  }
  
  // Başarı oranı
  const total = stats.connected + stats.failed;
  const successRate = total > 0 ? ((stats.connected / total) * 100).toFixed(1) : 0;
  console.log(`\n🎯 Başarı Oranı: ${successRate}%`);
}

// Tüm bağlantıları kapat
async function cleanup(): Promise<void> {
  console.log('\n🧹 Bağlantılar kapatılıyor...');
  
  for (const socket of sockets) {
    socket.close();
  }
  
  console.log(`✓ ${sockets.length} bağlantı kapatıldı.`);
}

// Ana fonksiyon
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const userCount = parseInt(args[0]) || DEFAULT_USERS;
  const serverUrl = args[1] || DEFAULT_URL;

  console.log('═══════════════════════════════════════════════════════');
  console.log('           🚀 CARDMATCH YÜK TESTİ BAŞLIYOR              ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Hedef Kullanıcı:   ${userCount}`);
  console.log(`  Sunucu URL:        ${serverUrl}`);
  console.log(`  Batch Boyutu:      ${BATCH_SIZE}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (userCount > 1000) {
    console.log('⚠️  UYARI: 1000+ kullanıcı testi için:');
    console.log('   - Yeterli RAM ve CPU gerekir');
    console.log('   - ulimit -n değerini artırın (macOS/Linux)');
    console.log('   - Production sunucu kullanın\n');
  }

  const startTime = Date.now();
  
  // Batch halinde bağlantılar oluştur
  const totalBatches = Math.ceil(userCount / BATCH_SIZE);
  
  for (let batch = 0; batch < totalBatches; batch++) {
    const startIndex = batch * BATCH_SIZE;
    const count = Math.min(BATCH_SIZE, userCount - startIndex);
    
    process.stdout.write(`\r📡 Bağlanıyor: ${startIndex + count}/${userCount} (Batch ${batch + 1}/${totalBatches})`);
    
    await createBatch(serverUrl, startIndex, count);
    
    if (batch < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n\n⏱️  Toplam Süre: ${(totalTime / 1000).toFixed(2)} saniye`);

  // Sonuçları yazdır
  printStats();

  // Eşleşme için biraz bekle
  if (stats.matchJoined > 0 && stats.matchFound === 0) {
    console.log('\n⏳ Eşleşmeler için 10 saniye bekleniyor...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(`💕 Bulunan Eşleşme: ${stats.matchFound}`);
  }

  // Temizlik
  await cleanup();
  
  console.log('\n✅ Test tamamlandı!\n');
  process.exit(0);
}

// Hata yakalama
process.on('uncaughtException', (error) => {
  console.error('\n❌ Kritik Hata:', error.message);
  cleanup().then(() => process.exit(1));
});

process.on('SIGINT', async () => {
  console.log('\n\n🛑 Test iptal edildi.');
  printStats();
  await cleanup();
  process.exit(0);
});

// Başlat
main().catch(console.error);
