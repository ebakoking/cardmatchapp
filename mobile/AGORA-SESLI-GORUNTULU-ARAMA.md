# Sesli ve Görüntülü Arama – Agora SDK (Secure Mode)

Agora entegrasyonu **Secure Mode (APP ID + Token)** ile yapıldı. Uygulama kanala girmeden önce backend'den RTC token alıyor.

## Yapman Gerekenler

### 1. Agora Console

- [Agora Console](https://console.agora.io) → **Create New Project** → **Secure Mode: APP ID + Token (RECOMMENDED)** seç.
- Proje oluşturduktan sonra **App ID** ve **App Certificate**’i kopyala (Proje ayarlarından).

### 2. Mobil `.env` (mobile klasörü)

```env
EXPO_PUBLIC_AGORA_APP_ID=senin_app_id_buraya
```

### 3. Backend `.env` (server klasörü)

```env
AGORA_APP_ID=senin_app_id_buraya
AGORA_APP_CERTIFICATE=senin_app_certificate_buraya
```

App Certificate’i **güvenli tut**; sadece sunucuda kullan, client’a koyma.

### 4. Build

- **Expo Go’da çalışmaz** – **EAS Build** (development veya production) gerekir.
- `eas build --platform ios` veya `eas build --platform android` ile build al.

## Akış

1. Kullanıcı aramaya bağlandığında (`callStatus === 'connected'`) uygulama `GET /api/agora/token?channelName=<friendshipId>&uid=<uid>` ile token ister (JWT ile korunuyor).
2. Backend `agora-token` ile RTC token üretir (1 saat geçerli) ve döner.
3. Uygulama bu token ile `joinChannel(token, channelId, uid, ...)` çağırır.
4. Token yoksa (backend’de certificate tanımlı değilse) boş token ile join denenir; Agora projesi **Testing Mode** ise çalışır, **Secure Mode** ise Agora reddeder.

## Kod Özeti

- **Backend `server/src/routes/agora.ts`**: `GET /api/agora/token` – giriş yapmış kullanıcı için `channelName` ve `uid` ile RTC token döner.
- **Mobile `src/services/agora.ts`**: Engine init/join/leave, mute/hoparlör/video; SDK sadece `initAgora` çağrıldığında yüklenir.
- **FriendCallScreen**: Bağlandığında önce token alır, sonra `agoraJoinChannel({ channelId, uid, token })` ile kanala girer.

## Gecikme ve “Bağlanamıyoruz” Sorunları

- **Arama isteği 5–10 sn gecikmeyle gidiyorsa:** Backend (örn. Render) **cold start** olabilir; sunucu uyandığı için ilk istek gecikmeli gelir. Çözüm: Render’da **Always On** (ücretli) kullanmak veya sunucuyu sık uyandıran bir ping/health-check kullanmak.
- **Açılıyor ama ses/görüntü bağlanmıyorsa:** Genelde **token** alınamıyor veya zaman aşımına uğruyor (yine cold start veya ağ). Uygulama artık token’ı 12 sn timeout ile alıyor, bir kez yeniden deniyor; token gelmezse “Sunucudan güvenlik anahtarı alınamadı” mesajı gösteriliyor. Backend’in çalıştığından ve `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE` tanımlı olduğundan emin ol.

## Not

Expo 50+ sürümlerinde `react-native-agora` ile bazen iOS build hatası bildiriliyor; gerekirse güncel [react-native-agora](https://www.npmjs.com/package/react-native-agora) ve Expo [development build](https://docs.expo.dev/develop/development-builds/introduction/) dokümanlarına bakın.
