// app.config.js - Environment variables support
// .env dosyasından değerleri okur
//
// ÖNEMLİ: Sunucu adresini değiştirmek için sadece .env dosyasını düzenleyin!
// Bu dosyaya dokunmanıza gerek yok.

// .env kontrolü - eğer API_URL yoksa uyarı ver
if (!process.env.API_URL) {
  console.warn('⚠️ API_URL tanımlı değil! .env dosyasını kontrol edin.');
}

export default {
  expo: {
    name: 'CardMatch',
    slug: 'cardmatch',
    version: '1.0.17',
    scheme: 'cardmatch',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0B1020',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.cardmatch.app',
      buildNumber: '1.0.17',
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSCameraUsageDescription:
          'Profil fotoğrafı ve doğrulama videosu çekmek için kameraya ihtiyacımız var.',
        NSMicrophoneUsageDescription:
          'Ses mesajları göndermek için mikrofona ihtiyacımız var.',
        NSPhotoLibraryUsageDescription:
          'Profil fotoğrafı yüklemek için fotoğraf galerinize erişmemiz gerekiyor.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B1020',
      },
      softwareKeyboardLayoutMode: 'resize',
      package: 'com.cardmatch.app',
    },
    plugins: [
      // expo-iap: Yerel "expo config" plugin çözümlemesi hata veriyor; build alabilmek için kapalı.
      // package.json'da expo-iap var, EAS build sırasında yüklenecek. Submit sonrası gerekirse tekrar aç.
      // 'expo-iap',
      'expo-notifications',
      'expo-camera',
      'expo-image-picker',
      'expo-web-browser',
      'expo-secure-store',
      'expo-apple-authentication',
      './plugins/withDisableFollyCoroutines',
    ],
    extra: {
      // ============================================================
      // SUNUCU ADRESI (.env dosyasından okunur)
      // ============================================================
      apiUrl: process.env.API_URL,
      socketUrl: process.env.SOCKET_URL,
      
      // RevenueCat
      revenuecatPublicKey: process.env.REVENUECAT_PUBLIC_KEY || '',
      
      // Google OAuth Client IDs
      googleExpoClientId: process.env.GOOGLE_EXPO_CLIENT_ID || '',
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '',
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || '',
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '',
      
      // EAS
      eas: {
        projectId: 'e5d78c7d-0cd4-4332-9789-513ed87bd31e',
      },
      // IAP Product ID override – "SKU not found" alıyorsan App Store Connect'teki Product ID'leri buraya yaz
      // App Store Connect Product ID'leri (varsayılan: com.cardmatch.app.*)
      // TestFlight’ta timer debug overlay (SHOW_TIMER_DEBUG_OVERLAY=true EAS env ile)
      showTimerDebugOverlay: process.env.SHOW_TIMER_DEBUG_OVERLAY === 'true',
      iapProductIds: {
        diamond_50: process.env.EXPO_PUBLIC_IAP_DIAMOND_50 || 'com.cardmatch.app.tokens_50',
        diamond_100: process.env.EXPO_PUBLIC_IAP_DIAMOND_100 || 'com.cardmatch.app.tokens_100',
        diamond_250: process.env.EXPO_PUBLIC_IAP_DIAMOND_250 || 'com.cardmatch.app.tokens_250',
        boost_1h: process.env.EXPO_PUBLIC_IAP_BOOST_1H || 'com.cardmatch.app.boost_1h',
        prime_weekly: process.env.EXPO_PUBLIC_IAP_PRIME_WEEKLY || 'com.cardmatch.app.prime_weekly2',
        prime_monthly: process.env.EXPO_PUBLIC_IAP_PRIME_MONTHLY || 'com.cardmatch.app.prime_monthly',
        prime_yearly: process.env.EXPO_PUBLIC_IAP_PRIME_YEARLY || 'com.cardmatch.app.prime_yearly2',
      },
    },
  },
};
