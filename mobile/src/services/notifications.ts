import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// Bildirim geldiğinde nasıl gösterileceğini ayarla
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Uygulama açılır açılmaz bildirim izni iste
 * Bu fonksiyon sadece izin ister, token kaydetmez
 */
export async function requestNotificationPermission(): Promise<boolean> {
  // Fiziksel cihaz değilse bildirim çalışmaz
  if (!Device.isDevice) {
    console.log('[Notifications] Simulator/Emulator - skipping');
    return false;
  }

  try {
    // Mevcut izin durumunu kontrol et
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    let finalStatus = existingStatus;
    
    // İzin verilmemişse iste
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Android için kanal oluştur
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CardMatch',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C5CE7',
      });
    }

    console.log('[Notifications] Permission status:', finalStatus);
    return finalStatus === 'granted';
  } catch (error) {
    console.error('[Notifications] Permission error:', error);
    return false;
  }
}

/**
 * Push token al ve sunucuya kaydet
 * Kullanıcı giriş yaptıktan sonra çağrılmalı
 */
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Notifications] Not a physical device, skipping token registration');
    return null;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Notifications] Permission not granted, skipping token registration');
      return null;
    }

    // Expo Push Token al
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    // Development'ta projectId yoksa veya geçersizse atla
    if (!projectId || projectId === 'your-eas-project-id' || projectId.length < 10) {
      console.log('[Notifications] No valid EAS projectId configured, skipping token registration');
      console.log('[Notifications] This is normal in development. Configure EAS for production.');
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    
    const token = tokenResponse.data;
    console.log('[Notifications] Push token:', token);

    // Sunucuya kaydet
    try {
      await api.post('/api/user/push-token', { token });
      console.log('[Notifications] Token saved to server');
    } catch (error) {
      console.error('[Notifications] Failed to save token:', error);
    }

    return token;
  } catch (error: any) {
    // Development'ta bu hata normaldir, sessizce atla
    if (error?.message?.includes('projectId') || error?.message?.includes('VALIDATION_ERROR')) {
      console.log('[Notifications] EAS not configured - skipping push token (normal in dev)');
      return null;
    }
    console.error('[Notifications] Token error:', error);
    return null;
  }
}

// Bildirim dinleyicileri
Notifications.addNotificationReceivedListener((notification) => {
  console.log('[Notifications] Received:', notification.request.content);
});

Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data;
  console.log('[Notifications] User tapped:', data);
  // TODO: İlgili ekrana yönlendir
});
