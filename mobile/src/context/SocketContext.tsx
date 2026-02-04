import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';
import { Socket } from 'socket.io-client';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;

    const s = getSocket();
    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
      console.log('[SocketContext] Socket BAĞLANDI! ID:', s.id);
    });

    s.on('connect_error', (err) => {
      console.log('[SocketContext] Bağlantı HATASI:', err.message);
    });

    s.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[SocketContext] Bağlantı KOPTU:', reason);
    });

    s.on('match:found', (data: unknown) => {
      console.log('[SocketContext] EŞLEŞME BULUNDU:', data);
    });

    return () => {
      s.off('connect');
      s.off('connect_error');
      s.off('disconnect');
      s.off('match:found');
    };
  }, [user?.id]); // ÖNEMLİ: user yerine user?.id - her user değişiminde değil, sadece user.id değişiminde çalışsın

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
