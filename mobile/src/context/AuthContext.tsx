import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { getSocket, joinUserRoom, leaveUserRoom } from '../services/socket';

export interface User {
  id: string;
  phoneNumber: string;
  nickname: string;
  age: number;
  birthDate?: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  interestedIn: 'MALE' | 'FEMALE' | 'BOTH';
  bio?: string | null;
  city: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  verified: boolean;
  isPlus: boolean;
  isPrime: boolean;
  primeExpiry?: string | null;
  // Prime filtre ayarları
  filterMinAge?: number;
  filterMaxAge?: number;
  filterMaxDistance?: number;
  tokenBalance: number;
  monthlyTokensEarned: number;  // Aylık kazanç (leaderboard)
  totalTokensEarned: number;    // Toplam kazanç (lifetime)
  monthlySparksEarned: number;  // Aylık spark (medya açılmasından)
  totalSparksEarned: number;    // Toplam spark
  dailyChatsStarted?: number;   // Bugün başlatılan sohbet sayısı
  isOnline: boolean;
  profilePhotos?: Array<{ id: string; url: string; order: number }>;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  onboardingCompleted: boolean;
  loginWithToken: (token: string, user: User) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateTokenBalance: (newBalance: number) => void;
  addTokens: (amount: number) => void;
  deductTokens: (amount: number) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Uygulama açıldığında AsyncStorage'dan token'ı yükle
  useEffect(() => {
    const loadStoredToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        if (storedToken) {
          setToken(storedToken);
          // Token varsa kullanıcı bilgisini çek
          try {
            const res = await api.get<{ success: boolean; data: User }>('/api/user/me', {
              headers: { Authorization: `Bearer ${storedToken}` }
            });
            if (res.data.success && res.data.data) {
              setUser(res.data.data);
              joinUserRoom(res.data.data.id);
              
              // Onboarding durumunu kontrol et
              const onboardingStatus = await AsyncStorage.getItem(`onboarding_completed_${res.data.data.id}`);
              setOnboardingCompleted(onboardingStatus === 'true');
            }
          } catch (err) {
            console.log('Failed to load user profile:', err);
            // Token geçersiz olabilir, temizle
            await AsyncStorage.removeItem('token');
            setToken(null);
          }
        }
      } catch (err) {
        console.log('Failed to load stored token:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStoredToken();
  }, []);

  useEffect(() => {
    if (!token) return;
    api.interceptors.request.use((config) => {
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`,
      };
      return config;
    });
  }, [token]);

  // Global socket listener for gift events (works even when not in FriendChatScreen)
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    console.log('[AuthContext] Setting up gift socket listeners for user:', user.id);

    // Hediye alındığında bakiyeyi güncelle
    const handleGiftReceived = async (payload: { fromUserId: string; amount: number; fromNickname: string; newBalance: number; newSparks?: number }) => {
      console.log('[AuthContext] ✅ Global gift RECEIVED:', payload);
      // Bakiyeyi güncelle
      setUser((prev) => {
        if (!prev) return prev;
        console.log('[AuthContext] Updating balance from', prev.tokenBalance, 'to', payload.newBalance);
        return {
          ...prev,
          tokenBalance: payload.newBalance,
          monthlySparksEarned: payload.newSparks ?? prev.monthlySparksEarned,
        };
      });
    };

    // Hediye gönderildiğinde bakiyeyi güncelle
    const handleGiftSent = async (payload: { toUserId: string; amount: number; newBalance: number }) => {
      console.log('[AuthContext] ✅ Global gift SENT:', payload);
      setUser((prev) => {
        if (!prev) return prev;
        console.log('[AuthContext] Updating sender balance from', prev.tokenBalance, 'to', payload.newBalance);
        return {
          ...prev,
          tokenBalance: payload.newBalance,
        };
      });
    };

    // Socket bağlantısını kontrol et
    console.log('[AuthContext] Socket connected:', socket.connected);
    
    // User room'a tekrar katıl (garantiye al)
    socket.emit('user:join', { userId: user.id });
    console.log('[AuthContext] Re-joined user room:', user.id);

    socket.on('friend:gift:received', handleGiftReceived);
    socket.on('friend:gift:sent', handleGiftSent);

    return () => {
      socket.off('friend:gift:received', handleGiftReceived);
      socket.off('friend:gift:sent', handleGiftSent);
    };
  }, [user?.id]);

  const loginWithToken = async (jwt: string, u: User) => {
    // Token'ı AsyncStorage'a kaydet
    await AsyncStorage.setItem('token', jwt);
    setToken(jwt);
    setUser(u);
    // Kullanıcıyı socket room'una katıl (gift:received vb. için)
    joinUserRoom(u.id);
    
    // Onboarding durumunu kontrol et (yeni kullanıcı için false olmalı)
    const onboardingStatus = await AsyncStorage.getItem(`onboarding_completed_${u.id}`);
    setOnboardingCompleted(onboardingStatus === 'true');
    console.log('[AuthContext] loginWithToken - onboardingCompleted:', onboardingStatus === 'true');
  };

  const logout = async () => {
    try {
      // API ile offline durumunu güncelle
      await api.post('/api/user/logout').catch(() => {});
    } catch (e) {
      // API hatası olsa bile çıkış yap
    }
    // Socket room'dan ayrıl
    leaveUserRoom();
    // AsyncStorage'dan token'ı sil
    await AsyncStorage.removeItem('token');
    setUser(null);
    setToken(null);
  };

  const refreshProfile = async () => {
    if (!token) return;
    const res = await api.get<{ success: boolean; data: User }>('/api/user/me');
    setUser(res.data.data);
  };

  const completeOnboarding = async () => {
    if (!user?.id) return;
    try {
      await AsyncStorage.setItem(`onboarding_completed_${user.id}`, 'true');
      setOnboardingCompleted(true);
      console.log('[AuthContext] Onboarding completed for user:', user.id);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  // Token bakiyesi güncelleme fonksiyonları
  const updateTokenBalance = useCallback((newBalance: number) => {
    setUser((prev) => prev ? { ...prev, tokenBalance: newBalance } : null);
  }, []);

  const addTokens = useCallback((amount: number) => {
    setUser((prev) => prev ? { ...prev, tokenBalance: prev.tokenBalance + amount } : null);
  }, []);

  const deductTokens = useCallback((amount: number) => {
    setUser((prev) => prev ? { ...prev, tokenBalance: Math.max(0, prev.tokenBalance - amount) } : null);
  }, []);

  // Socket listener - bakiye değişikliklerini dinle
  useEffect(() => {
    if (!user?.id) return;

    const socket = getSocket();

    // Token bakiyesi güncellendi (genel)
    socket.on('token:balance_updated', (payload: { userId: string; newBalance: number }) => {
      if (payload.userId === user.id) {
        console.log('[AuthContext] Token balance updated:', payload.newBalance);
        updateTokenBalance(payload.newBalance);
      }
    });

    // Hediye aldığında
    socket.on('gift:received', (payload: { amount: number; fromNickname: string }) => {
      console.log('[AuthContext] Gift received:', payload);
      addTokens(payload.amount);
    });

    // Hediye gönderdiğinde (socket'ten de dinle)
    socket.on('gift:sent', (payload: { amount: number; newBalance: number }) => {
      console.log('[AuthContext] Gift sent:', payload);
      updateTokenBalance(payload.newBalance);
    });

    // Medya görüntüleme için token harcandığında
    socket.on('token:spent', (payload: { amount: number; newBalance: number }) => {
      console.log('[AuthContext] Token spent:', payload);
      updateTokenBalance(payload.newBalance);
    });

    // SPARK kazandığında (medya görüntülemesinden)
    socket.on('spark:earned', (payload: { 
      amount: number; 
      monthlySparksEarned?: number; 
      totalSparksEarned?: number;
    }) => {
      console.log('[AuthContext] Spark earned:', payload);
      setUser((prev) => {
        if (!prev) return null;
        // Backend'den gelen değerleri direkt kullan (hesaplama yapma - 2x eklemeyi önle)
        return { 
          ...prev, 
          monthlySparksEarned: payload.monthlySparksEarned ?? prev.monthlySparksEarned ?? 0,
          totalSparksEarned: payload.totalSparksEarned ?? prev.totalSparksEarned ?? 0,
        };
      });
    });

    // Prime abonelik güncellendiğinde
    socket.on('prime:updated', (payload: { isPrime: boolean; primeExpiry: string }) => {
      console.log('[AuthContext] Prime updated:', payload);
      setUser((prev) => prev ? { 
        ...prev, 
        isPrime: payload.isPrime,
        primeExpiry: payload.primeExpiry,
      } : null);
    });

    return () => {
      socket.off('token:balance_updated');
      socket.off('gift:received');
      socket.off('gift:sent');
      socket.off('token:spent');
      socket.off('spark:earned');
      socket.off('prime:updated');
    };
  }, [user?.id, updateTokenBalance, addTokens]);

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        token, 
        loading, 
        onboardingCompleted,
        loginWithToken, 
        logout, 
        refreshProfile,
        completeOnboarding,
        updateTokenBalance,
        addTokens,
        deductTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

