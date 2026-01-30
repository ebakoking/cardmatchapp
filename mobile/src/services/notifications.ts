import * as Notifications from 'expo-notifications';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== 'granted') {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync();

  try {
    await api.post('/api/user/push-token', {
      token: token.data,
    });
  } catch {
    // TODO: handle error
  }

  return token.data;
}

Notifications.addNotificationReceivedListener((notification) => {
  // Handle notification received while app is in foreground
});

Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data;
  // Navigate to relevant screen based on data
});
