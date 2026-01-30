import fetch from 'node-fetch';
import { prisma } from '../prisma';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(
  userId: string,
  notification: PushNotificationPayload,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user?.expoPushToken) return;

  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: user.expoPushToken,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      sound: 'default',
      badge: 1,
    }),
  });
}

