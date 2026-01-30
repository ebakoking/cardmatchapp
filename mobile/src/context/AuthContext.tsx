import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';
import { getSocket, joinUserRoom, leaveUserRoom } from '../services/socket';

// ============ USER INTERFACE ============
export interface User {
  id: string;
  phoneNumber?: string | null;
  email?: string | null;
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
  authProvider: string;
  verified: boolean;
  isPlus: boolean;
  isPrime: boolean;
  primeExpiry?: string | null;
  // Prime filtre ayarları
  filterMinAge?: number;
  filterMaxAge?: number;
  filterMaxDistance?: number;
  tokenBalance: number;
  monthlyTokensEarned: number;
  totalTokensEarned: number;
  monthlySparksEarned: number;
  totalSparksEarned: number;
  dailyChatsStarted?: number;
  isOnline: boolean;
  profilePhotos?: Array<{ id: string; url: string; order: number }>;
}

// ============ CONTEXT INTERFACE ============
interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  onboardingCompleted: boolean;
  // Yeni loginWithToken - refresh token destekli
  loginWithToken: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  completeOnboarding: () => Promise<void>;
  updateTokenBalance: (newBalance: number) => void;
  addTokens: (amount: number) => void;
  deductTokens: (amount: number) => void;
}

// ============ STORAGE KEYS ============
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user_data',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  
  // Token refresh lock (çift refresh önleme)
  const isRefreshing = useRef(false);

  // ============ API INTERCEPTOR ============
  useEffect(() => {
    // Request interceptor - her isteğe token ekle
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers = {
            ...(config.headers || {}),
            Authorization: `Bearer ${token}`,
          };
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - 401 durumunda token yenile
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Token expired ve henüz retry edilmediyse
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Token yenilemeyi dene
          const success = await refreshAccessToken();
          if (success) {
            // Yeni token ile tekrar dene
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [token]);

  // ============ UYGULAMA BAŞLANGIÇTA TOKEN YÜKLE ============
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        // === DEV: Tüm eski oturum verilerini temizle (yeni auth sistemi için) ===
        // Bu satırı production'da kaldır
        const FORCE_CLEAR_AUTH = true; // Yeni auth sistemi için bir kerelik temizlik
        const authVersion = await AsyncStorage.getItem('auth_version');
        
        if (FORCE_CLEAR_AUTH && authVersion !== 'v2') {
          console.log('[AuthContext] 🧹 Clearing old auth data for new system...');
          await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
          await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
          await AsyncStorage.removeItem('token');
          await AsyncStorage.setItem('auth_version', 'v2');
          setLoading(false);
          return; // Temiz başla
        }
        
        // Access token'ı al
        const storedAccessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
        const storedRefreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        
        console.log('[AuthContext] Stored tokens:', { 
          hasAccessToken: !!storedAccessToken, 
          hasRefreshToken: !!storedRefreshToken 
        });
        
        if (storedAccessToken) {
          setToken(storedAccessToken);
          
          // Kullanıcı bilgisini çek
          try {
            const res = await api.get<{ success: boolean; data: { user: User; isProfileComplete: boolean } }>('/api/auth/me', {
              headers: { Authorization: `Bearer ${storedAccessToken}` }
            });
            
            if (res.data.success && res.data.data.user) {
              setUser(res.data.data.user);
              joinUserRoom(res.data.data.user.id);
              
              // Onboarding durumunu kontrol et
              const onboardingStatus = await AsyncStorage.getItem(`onboarding_completed_${res.data.data.user.id}`);
              setOnboardingCompleted(onboardingStatus === 'true' || res.data.data.isProfileComplete);
            }
          } catch (err: any) {
            console.log('[AuthContext] Failed to load user profile:', err.message);
            
            // Token expired - refresh dene
            if (err.response?.status === 401 && storedRefreshToken) {
              console.log('[AuthContext] Trying to refresh token...');
              const refreshed = await tryRefreshToken(storedRefreshToken);
              if (!refreshed) {
                // Refresh başarısız - tüm tokenları temizle
                await clearAllTokens();
              }
            } else {
              await clearAllTokens();
            }
          }
        }
      } catch (err) {
        console.log('[AuthContext] Failed to load stored auth:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadStoredAuth();
  }, []);

  // ============ SOCKET LISTENERS ============
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    console.log('[AuthContext] Setting up socket listeners for user:', user.id);
    
    // User room'a katıl
    socket.emit('user:join', { userId: user.id });

    // Gift events
    const handleGiftReceived = (payload: { fromUserId: string; amount: number; fromNickname: string; newBalance: number; newSparks?: number }) => {
      console.log('[AuthContext] Gift received:', payload);
      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tokenBalance: payload.newBalance,
          monthlySparksEarned: payload.newSparks ?? prev.monthlySparksEarned,
        };
      });
    };

    const handleGiftSent = (payload: { toUserId: string; amount: number; newBalance: number }) => {
      console.log('[AuthContext] Gift sent:', payload);
      setUser((prev) => prev ? { ...prev, tokenBalance: payload.newBalance } : prev);
    };

    const handleTokenBalanceUpdated = (payload: { userId: string; newBalance: number }) => {
      if (payload.userId === user.id) {
        console.log('[AuthContext] Token balance updated:', payload.newBalance);
        setUser((prev) => prev ? { ...prev, tokenBalance: payload.newBalance } : prev);
      }
    };

    const handleTokenSpent = (payload: { amount: number; newBalance: number }) => {
      console.log('[AuthContext] Token spent:', payload);
      setUser((prev) => prev ? { ...prev, tokenBalance: payload.newBalance } : prev);
    };

    const handleSparkEarned = (payload: { amount: number; monthlySparksEarned?: number; totalSparksEarned?: number }) => {
      console.log('[AuthContext] Spark earned:', payload);
      setUser((prev) => {
        if (!prev) return null;
        return { 
          ...prev, 
          monthlySparksEarned: payload.monthlySparksEarned ?? prev.monthlySparksEarned,
          totalSparksEarned: payload.totalSparksEarned ?? prev.totalSparksEarned,
        };
      });
    };

    const handlePrimeUpdated = (payload: { isPrime: boolean; primeExpiry: string }) => {
      console.log('[AuthContext] Prime updated:', payload);
      setUser((prev) => prev ? { ...prev, isPrime: payload.isPrime, primeExpiry: payload.primeExpiry } : prev);
    };

    // Listeners ekle
    socket.on('friend:gift:received', handleGiftReceived);
    socket.on('friend:gift:sent', handleGiftSent);
    socket.on('gift:received', handleGiftReceived);
    socket.on('gift:sent', handleGiftSent);
    socket.on('token:balance_updated', handleTokenBalanceUpdated);
    socket.on('token:spent', handleTokenSpent);
    socket.on('spark:earned', handleSparkEarned);
    socket.on('prime:updated', handlePrimeUpdated);

    return () => {
      socket.off('friend:gift:received', handleGiftReceived);
      socket.off('friend:gift:sent', handleGiftSent);
      socket.off('gift:received', handleGiftReceived);
      socket.off('gift:sent', handleGiftSent);
      socket.off('token:balance_updated', handleTokenBalanceUpdated);
      socket.off('token:spent', handleTokenSpent);
      socket.off('spark:earned', handleSparkEarned);
      socket.off('prime:updated', handlePrimeUpdated);
    };
  }, [user?.id]);

  // ============ HELPER FUNCTIONS ============
  
  const clearAllTokens = async () => {
    console.log('[AuthContext] Clearing all tokens...');
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      // Eski format token'ı da temizle
      await AsyncStorage.removeItem('token');
    } catch (e) {
      console.log('[AuthContext] Error clearing tokens:', e);
    }
    setToken(null);
    setUser(null);
    setOnboardingCompleted(false);
  };

  const tryRefreshToken = async (refreshToken: string): Promise<boolean> => {
    if (isRefreshing.current) return false;
    isRefreshing.current = true;
    
    try {
      const res = await api.post('/api/auth/refresh', { refreshToken });
      
      if (res.data.success) {
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data.data;
        
        // Yeni tokenları kaydet
        await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
        setToken(newAccessToken);
        
        console.log('[AuthContext] Token refreshed successfully');
        return true;
      }
    } catch (err) {
      console.log('[AuthContext] Token refresh failed:', err);
    } finally {
      isRefreshing.current = false;
    }
    
    return false;
  };

  // ============ PUBLIC FUNCTIONS ============

  const loginWithToken = async (accessToken: string, refreshToken: string, userData: User) => {
    // Tokenları SecureStore'a kaydet
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    
    setToken(accessToken);
    setUser(userData);
    
    // Socket room'a katıl
    joinUserRoom(userData.id);
    
    // Onboarding durumunu kontrol et
    const onboardingStatus = await AsyncStorage.getItem(`onboarding_completed_${userData.id}`);
    setOnboardingCompleted(onboardingStatus === 'true');
    
    console.log('[AuthContext] loginWithToken - user:', userData.nickname);
  };

  const logout = async () => {
    try {
      // API ile logout (refresh token iptal)
      await api.post('/api/auth/logout').catch(() => {});
    } catch (e) {
      // API hatası olsa bile çıkış yap
    }
    
    // Socket room'dan ayrıl
    leaveUserRoom();
    
    // Tüm tokenları temizle
    await clearAllTokens();
    
    console.log('[AuthContext] User logged out');
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const res = await api.get<{ success: boolean; data: { user: User } }>('/api/auth/me');
      if (res.data.success && res.data.data.user) {
        setUser(res.data.data.user);
      }
    } catch (err) {
      console.log('[AuthContext] Failed to refresh profile:', err);
    }
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    const storedRefreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    if (!storedRefreshToken) return false;
    return tryRefreshToken(storedRefreshToken);
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

  // Token balance functions
  const updateTokenBalance = useCallback((newBalance: number) => {
    setUser((prev) => prev ? { ...prev, tokenBalance: newBalance } : null);
  }, []);

  const addTokens = useCallback((amount: number) => {
    setUser((prev) => prev ? { ...prev, tokenBalance: prev.tokenBalance + amount } : null);
  }, []);

  const deductTokens = useCallback((amount: number) => {
    setUser((prev) => prev ? { ...prev, tokenBalance: Math.max(0, prev.tokenBalance - amount) } : null);
  }, []);

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
        refreshAccessToken,
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
