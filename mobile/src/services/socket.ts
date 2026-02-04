import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

const { socketUrl } = (Constants.expoConfig?.extra || {}) as {
  socketUrl?: string;
};

let socket: Socket | null = null;
let joinedUserId: string | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

const HEARTBEAT_MS = 30000;

export function getSocket() {
  if (!socket) {
    if (!socketUrl) {
      console.error('❌ SOCKET_URL tanımlı değil! .env / app.config.js extra.socketUrl kontrol et.');
    } else {
      console.log('[Socket] URL kullanılıyor:', socketUrl.startsWith('https') ? 'HTTPS' : socketUrl.startsWith('http') ? 'HTTP' : 'custom');
    }
    socket = io(socketUrl || '', {
      transports: ['websocket'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    // İlk bağlantı hatası (TestFlight / Safari console'da görünür)
    socket.on('connect_error', (err) => {
      console.log('[Socket] Bağlantı HATASI:', err.message);
    });

    // 🔒 MEMORY LEAK FIX: Connect event - rejoin user room
    socket.on('connect', () => {
      console.log('[Socket] ✅ BAĞLANDI – ID:', socket?.id);

      // Heartbeat restart
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (socket?.connected) socket.emit('ping');
      }, HEARTBEAT_MS);

      // 🔒 RECONNECTION FIX: Rejoin user room if previously joined
      if (joinedUserId) {
        console.log('[Socket] 🔄 Reconnected - rejoining user room:', joinedUserId);
        socket.emit('user:join', { userId: joinedUserId });
      }
    });

    // Disconnect event - cleanup heartbeat only
    socket.on('disconnect', (reason) => {
      console.log('[Socket] ❌ Bağlantı KOPTU:', reason);
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      // 🔒 MEMORY LEAK FIX: Listener'ları temizleme - sadece explicit disconnectSocket'te yapılmalı
      // Network disconnect durumunda listener'lar kalmalı
    });

    // Reconnect attempt logging
    socket.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket] 🔄 Reconnection attempt ${attempt}...`);
    });

    socket.on('reconnect_error', (error) => {
      console.log('[Socket] ⚠️ Reconnection error:', error.message);
    });

    socket.on('reconnect_failed', () => {
      console.log('[Socket] ❌ Reconnection failed');
    });
  }
  return socket;
}

/** Logout vb. için tüm listener'ları kaldırıp bağlantıyı keser. */
export function disconnectSocket() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (joinedUserId) {
    const s = socket;
    if (s) s.emit('user:leave', { userId: joinedUserId });
    joinedUserId = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
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

