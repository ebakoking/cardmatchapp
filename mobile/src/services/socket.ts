import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

const { socketUrl } = (Constants.expoConfig?.extra || {}) as {
  socketUrl?: string;
};

let socket: Socket | null = null;
let joinedUserId: string | null = null;

export function getSocket() {
  if (!socket) {
    if (!socketUrl) {
      console.error('❌ SOCKET_URL tanımlı değil! .env dosyasını kontrol edin.');
    }
    socket = io(socketUrl || '', {
      transports: ['websocket'],
    });
  }
  return socket;
}

// Kullanıcıyı kendi room'una katıl (kişisel event'leri almak için)
export function joinUserRoom(userId: string) {
  const s = getSocket();
  if (userId && userId !== joinedUserId) {
    console.log('[Socket] Joining user room:', userId);
    s.emit('user:join', { userId });
    joinedUserId = userId;
  }
}

// Kullanıcı çıkışında room'dan ayrıl
export function leaveUserRoom() {
  if (joinedUserId) {
    const s = getSocket();
    s.emit('user:leave', { userId: joinedUserId });
    joinedUserId = null;
  }
}

