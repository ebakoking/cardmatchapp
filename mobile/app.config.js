// app.config.js - Environment variables support
// .env dosyasından veya environment'tan değerleri okur

export default {
  expo: {
    name: 'CardMatch',
    slug: 'cardmatch',
    version: '0.1.0',
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
      buildNumber: '1.0.0',
      infoPlist: {
        NSCameraUsageDescription:
          'Profil fotoğrafı ve doğrulama videosu çekmek için kameraya ihtiyacımız var.',
        NSMicrophoneUsageDescription:
          'Sesli ve görüntülü aramalar için mikrofona ihtiyacımız var.',
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
      'expo-notifications',
      'expo-camera',
      'expo-image-picker',
      'expo-web-browser',
      'expo-secure-store',
      'expo-apple-authentication',
    ],
    extra: {
      // API URLs
      apiUrl: process.env.API_URL || 'http://192.168.1.3:3000',
      socketUrl: process.env.SOCKET_URL || 'ws://192.168.1.3:3000',
      
      // RevenueCat
      revenuecatPublicKey: process.env.REVENUECAT_PUBLIC_KEY || '',
      
      // Google OAuth Client IDs
      // Google Cloud Console'dan alınacak değerler
      googleExpoClientId: process.env.GOOGLE_EXPO_CLIENT_ID || '',
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '',
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || '',
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '',
      
      // EAS
      eas: {
        projectId: 'your-project-id',
      },
    },
  },
};
