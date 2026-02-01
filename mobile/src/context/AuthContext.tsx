import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { api, resetAuthMeThrottle } from '../services/api';
import { getSocket, joinUserRoom, leaveUserRoom } from '../services/socket';
import { registerPushToken } from '../services/notifications';

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
  avatarId?: number;
  profilePhotoUrl?: string; // Prime için özel profil fotoğrafı
  profilePhotos?: Array<{ id: string; url: string; order: number; type?: 'CORE' | 'DAILY'; caption?: string }>;
}

// ============ CONTEXT INTERFACE ============
interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  onboardingCompleted: boolean;
  // 🚀 ANLIK: Ayrı balance state - hızlı güncelleme için
  instantBalance: number;
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

// Render counter - AuthProvider kaç kez render oluyor?
let authProviderRenderCount = 0;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  authProviderRenderCount++;
  
  // 🔴 Her 10 render'da bir log at
  if (authProviderRenderCount % 10 === 1) {
    console.log(`🔴 AUTH PROVIDER V5 - render #${authProviderRenderCount}`);
  }
  
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  
  // 🚀 ANLIK BAKİYE: Ayrı state - daha hızlı güncelleme için
  const [instantBalance, setInstantBalance] = useState<number>(0);
  
  // Token refresh lock (çift refresh önleme)
  const isRefreshing = useRef(false);
  // Logout işlemi sırasında state güncellemelerini engelle
  const isLoggingOut = useRef(false);
  // refreshProfile throttle - aşırı çağrıları engelle
  const lastRefreshTime = useRef(0);
  const isRefreshingProfile = useRef(false);
  const refreshCallCount = useRef(0); // Debug: kaç kez çağrıldı
  
  // ============ BALANCE PROTECTION SYSTEM ============
  // Balance değişikliklerini track etmek için rev (version) sistemi
  const balanceRevRef = useRef<number>(0);
  
  // ============ setUserSafe - TÜM USER YAZMALARI BURADAN GEÇER ============
  // preserveBalance: true = balance değerleri korunur (default)
  // preserveBalance: false = balance dahil tüm alanlar güncellenir (sadece login/logout için)
  const setUserSafe = useCallback((
    updater: User | null | ((prev: User | null) => User | null),
    source: string,
    preserveBalance: boolean = true
  ) => {
    // Önce next değerini hesapla (instantBalance için)
    const nextValue = typeof updater === 'function' ? null : updater;
    
    setUser((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      
      // null set ediliyor (logout)
      if (next === null) {
        console.log(`[AuthContext] 👤 setUserSafe source=${source} -> null`);
        setInstantBalance(0);
        return null;
      }
      
      // İlk yükleme (prev null)
      if (!prev) {
        console.log(`[AuthContext] 👤 setUserSafe source=${source} -> FIRST LOAD, balance: ${next?.tokenBalance}`);
        balanceRevRef.current = Date.now();
        // 🚀 ANLIK: instantBalance'ı da güncelle
        if (next.tokenBalance !== undefined) {
          setInstantBalance(next.tokenBalance);
        }
        return next;
      }
      
      // Balance korunacak mı?
      if (preserveBalance) {
        const result = {
          ...next,
          tokenBalance: prev.tokenBalance,
          monthlySparksEarned: prev.monthlySparksEarned,
          totalSparksEarned: prev.totalSparksEarned,
        };
        console.log(`[AuthContext] 👤 setUserSafe source=${source} BALANCE PRESERVED: ${prev.tokenBalance} (incoming was ${next.tokenBalance})`);
        return result;
      } else {
        // Balance dahil tüm alanlar güncelleniyor
        console.log(`[AuthContext] 👤 setUserSafe source=${source} FULL UPDATE: ${prev.tokenBalance} -> ${next.tokenBalance}`);
        balanceRevRef.current = Date.now();
        // 🚀 ANLIK: instantBalance'ı da güncelle
        if (next.tokenBalance !== undefined) {
          setInstantBalance(next.tokenBalance);
        }
        return next;
      }
    });
  }, []);
  
  // Balance güncelleme fonksiyonu - SADECE BALANCE İÇİN
  const applyBalance = useCallback((
    incoming: { tokenBalance?: number; monthlySparksEarned?: number; totalSparksEarned?: number },
    source: string
  ) => {
    const newRev = Date.now();
    
    // Boş payload ignore
    if (incoming.tokenBalance === undefined && incoming.monthlySparksEarned === undefined) {
      console.log(`[AuthContext] ⏭️ applyBalance SKIPPED (empty) - source: ${source}`);
      return;
    }
    
    // 🚀 ANLIK: Ayrı balance state'i de güncelle
    if (incoming.tokenBalance !== undefined) {
      console.log(`[AuthContext] 🚀 INSTANT balance update: ${incoming.tokenBalance} (source: ${source})`);
      setInstantBalance(incoming.tokenBalance);
    }
    
    setUser((prev) => {
      if (!prev) return prev;
      
      const oldTokenBalance = prev.tokenBalance;
      const newTokenBalance = incoming.tokenBalance ?? prev.tokenBalance;
      
      console.log(`[AuthContext] 💰 applyBalance - source: ${source}`);
      console.log(`[AuthContext] 💰 tokenBalance: ${oldTokenBalance} -> ${newTokenBalance}`);
      
      // Rev'i güncelle
      balanceRevRef.current = newRev;
      
      return {
        ...prev,
        tokenBalance: newTokenBalance,
        monthlySparksEarned: incoming.monthlySparksEarned ?? prev.monthlySparksEarned,
        totalSparksEarned: incoming.totalSparksEarned ?? prev.totalSparksEarned,
      };
    });
  }, []);

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
        // Auth version kontrolü - eski oturumları temizlemek için
        // NOT: FORCE_CLEAR_AUTH sadece auth sistemi değiştiğinde true olmalı
        const FORCE_CLEAR_AUTH = false; // Production için false
        const authVersion = await AsyncStorage.getItem('auth_version');
        
        if (FORCE_CLEAR_AUTH && authVersion !== 'v3') {
          console.log('[AuthContext] 🧹 Clearing old auth data for new system...');
          await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
          await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
          await AsyncStorage.removeItem('token');
          await AsyncStorage.setItem('auth_version', 'v3');
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
              // İlk yükleme - balance dahil tüm veriyi al (preserveBalance: false)
              setUserSafe(res.data.data.user, 'loadStoredAuth', false);
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

    // Gift events - applyBalance kullan
    const handleGiftReceived = (payload: { fromUserId: string; amount: number; fromNickname: string; newBalance: number; newSparks?: number }) => {
      console.log('[AuthContext] 🎁 gift:received - amount:', payload.amount);
      applyBalance({ 
        tokenBalance: payload.newBalance,
        monthlySparksEarned: payload.newSparks,
      }, 'gift:received');
    };

    const handleGiftSent = (payload: { toUserId: string; amount: number; newBalance: number }) => {
      console.log('[AuthContext] 🎁 gift:sent - amount:', payload.amount);
      applyBalance({ tokenBalance: payload.newBalance }, 'gift:sent');
    };

    const handleTokenBalanceUpdated = (payload: { userId: string; newBalance: number }) => {
      if (payload.userId === user.id) {
        console.log('[AuthContext] ⚠️ token:balance_updated received - USING applyBalance');
        applyBalance({ tokenBalance: payload.newBalance }, 'token:balance_updated');
      }
    };

    const handleTokenSpent = (payload: { amount: number; newBalance: number }) => {
      console.log('[AuthContext] 💰 token:spent received - amount:', payload.amount, 'newBalance:', payload.newBalance);
      applyBalance({ tokenBalance: payload.newBalance }, 'token:spent');
    };

    const handleTokenEarned = (payload: { amount: number; newBalance: number; reason?: string }) => {
      console.log('[AuthContext] 💎 token:earned received - amount:', payload.amount, 'newBalance:', payload.newBalance, 'reason:', payload.reason);
      applyBalance({ tokenBalance: payload.newBalance }, 'token:earned');
    };

    const handleSparkEarned = (payload: { amount: number; monthlySparksEarned?: number; totalSparksEarned?: number }) => {
      console.log('[AuthContext] ✨ spark:earned received - amount:', payload.amount);
      applyBalance({ 
        monthlySparksEarned: payload.monthlySparksEarned,
        totalSparksEarned: payload.totalSparksEarned,
      }, 'spark:earned');
    };

    const handlePrimeUpdated = (payload: { isPrime: boolean; primeExpiry: string }) => {
      console.log('[AuthContext] Prime updated:', payload);
      setUserSafe(
        (prev) => prev ? { ...prev, isPrime: payload.isPrime, primeExpiry: payload.primeExpiry } : prev,
        'prime:updated',
        true // Balance koru
      );
    };

    // 🔔 Arkadaş bildirimi - local notification göster
    const handleFriendNotification = async (payload: { 
      type: string; 
      friendshipId: string; 
      senderId: string; 
      senderNickname: string; 
      preview: string; 
      timestamp: string;
    }) => {
      console.log('[AuthContext] 🔔 Friend notification:', payload);
      
      // Local notification göster
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `💬 ${payload.senderNickname}`,
            body: payload.preview,
            data: { 
              type: 'friend_message',
              friendshipId: payload.friendshipId,
              senderId: payload.senderId,
            },
            sound: 'default',
          },
          trigger: null, // Hemen göster
        });
      } catch (error) {
        console.log('[AuthContext] Notification error:', error);
      }
    };
    
    // 📞 Gelen arama bildirimi
    const handleIncomingCall = async (payload: { 
      fromUserId: string; 
      fromNickname: string; 
      fromPhoto?: string;
      callType: 'voice' | 'video';
      friendshipId: string;
      toUserId?: string;
    }) => {
      console.log('[AuthContext] 📞 Incoming call:', payload);
      
      // 🚨 Kendi aramam ise bildirimi gösterme!
      if (payload.fromUserId === user?.id) {
        console.log('[AuthContext] 📞 Ignoring - I am the caller');
        return;
      }
      
      // Local notification göster
      try {
        const callTypeText = payload.callType === 'video' ? '📹 Görüntülü' : '📞 Sesli';
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${callTypeText} Arama`,
            body: `${payload.fromNickname} sizi arıyor...`,
            data: { 
              type: 'incoming_call',
              friendshipId: payload.friendshipId,
              fromUserId: payload.fromUserId,
              callType: payload.callType,
            },
            sound: 'default',
          },
          trigger: null, // Hemen göster
        });
      } catch (error) {
        console.log('[AuthContext] Call notification error:', error);
      }
    };

    // Listeners ekle
    socket.on('friend:notification', handleFriendNotification);
    socket.on('friend:call:incoming', handleIncomingCall);
    socket.on('friend:gift:received', handleGiftReceived);
    socket.on('friend:gift:sent', handleGiftSent);
    socket.on('gift:received', handleGiftReceived);
    socket.on('gift:sent', handleGiftSent);
    socket.on('token:balance_updated', handleTokenBalanceUpdated);
    socket.on('token:spent', handleTokenSpent);
    socket.on('token:earned', handleTokenEarned);
    socket.on('spark:earned', handleSparkEarned);
    socket.on('prime:updated', handlePrimeUpdated);

    return () => {
      socket.off('friend:notification', handleFriendNotification);
      socket.off('friend:call:incoming', handleIncomingCall);
      socket.off('friend:gift:received', handleGiftReceived);
      socket.off('friend:gift:sent', handleGiftSent);
      socket.off('gift:received', handleGiftReceived);
      socket.off('gift:sent', handleGiftSent);
      socket.off('token:balance_updated', handleTokenBalanceUpdated);
      socket.off('token:spent', handleTokenSpent);
      socket.off('token:earned', handleTokenEarned);
      socket.off('spark:earned', handleSparkEarned);
      socket.off('prime:updated', handlePrimeUpdated);
    };
  }, [user?.id, applyBalance]);

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
    setUserSafe(null, 'clearAllTokens', false);
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
        resetAuthMeThrottle(); // Throttle'ı resetle ki retry yapılabilsin
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
    // Login - balance dahil tüm veriyi al (preserveBalance: false)
    setUserSafe(userData, 'loginWithToken', false);
    
    // Socket room'a katıl
    joinUserRoom(userData.id);
    
    // Push token kaydet (arka planda)
    registerPushToken().catch(err => console.log('[AuthContext] Push token error:', err));
    
    // Onboarding durumunu kontrol et
    const onboardingStatus = await AsyncStorage.getItem(`onboarding_completed_${userData.id}`);
    setOnboardingCompleted(onboardingStatus === 'true');
    
    console.log('[AuthContext] loginWithToken - user:', userData.nickname);
  };

  const logout = async () => {
    console.log('[AuthContext] Logout started...');
    
    // Logout işlemi başladı - diğer state güncellemelerini engelle
    isLoggingOut.current = true;
    
    // Socket room'dan ayrıl (state update'lerden önce)
    leaveUserRoom();
    
    // Storage temizle (sync olmadan)
    SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN).catch(() => {});
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN).catch(() => {});
    AsyncStorage.removeItem('token').catch(() => {});
    
    // ÖNCELİKLE state'leri temizle (navigation hemen güncellensin)
    setToken(null);
    setUserSafe(null, 'logout', false);
    setOnboardingCompleted(false);
    
    // API ile logout (refresh token iptal) - en son yap, başarısız olsa bile sorun değil
    api.post('/api/auth/logout').catch(() => {});
    
    console.log('[AuthContext] User logged out');
    
    // Biraz bekle sonra isLoggingOut'u sıfırla
    setTimeout(() => {
      isLoggingOut.current = false;
    }, 1000);
  };

  // ÖNEMLİ: useCallback ile sarıldı - referans değişmemesi için
  // Bu olmadan ProfileScreen'deki useFocusEffect sonsuz döngüye giriyor
  // THROTTLE: En fazla 10 saniyede bir çağrılabilir
  const refreshProfile = useCallback(async () => {
    refreshCallCount.current++;
    const callNum = refreshCallCount.current;
    
    // 🔴🔴🔴 HER ÇAĞRI LOGLA - SPAM TESPİT İÇİN 🔴🔴🔴
    console.log(`🔴🔴🔴 refreshProfile CALL #${callNum} - V6 🔴🔴🔴`);
    
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;
    
    // 10 SANİYE içinde tekrar çağrılmışsa ATLA
    if (timeSinceLastRefresh < 10000) {
      return; // Sessizce atla
    }
    
    // Zaten çalışıyorsa ATLA
    if (isRefreshingProfile.current) {
      return;
    }
    
    console.log(`[AuthContext] ✅ refreshProfile #${callNum} EXECUTING after ${timeSinceLastRefresh}ms`);
    
    if (!token || isLoggingOut.current) return;
    
    isRefreshingProfile.current = true;
    lastRefreshTime.current = now;
    
    try {
      console.log('[AuthContext] 🔄 refreshProfile called, current balance:', user?.tokenBalance);
      const res = await api.get<{ success: boolean; data: { user: User } }>('/api/auth/me');
      if (res.data.success && res.data.data.user && !isLoggingOut.current) {
        const incomingUser = res.data.data.user;
        console.log('[AuthContext] 🔄 refreshProfile got user, incoming balance:', incomingUser.tokenBalance);
        
        // ÖNEMLİ: Balance'ı KORUYARAK user'ı güncelle
        // Socket eventleri daha güncel balance sağlıyor, DB'den gelen stale olabilir
        setUserSafe(incomingUser, 'refreshProfile', true); // Balance korunacak
      }
    } catch (err) {
      console.log('[AuthContext] Failed to refresh profile:', err);
    } finally {
      isRefreshingProfile.current = false;
    }
  }, [token, setUserSafe]); // user'ı dependency olarak EKLEME - balance log için gerek yok

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
    console.log('[AuthContext] updateTokenBalance called:', newBalance);
    applyBalance({ tokenBalance: newBalance }, 'updateTokenBalance');
  }, [applyBalance]);

  const addTokens = useCallback((amount: number) => {
    console.log('[AuthContext] addTokens called:', amount);
    setUser((prev) => {
      if (!prev) return null;
      const newBalance = prev.tokenBalance + amount;
      balanceRevRef.current = Date.now();
      console.log(`[AuthContext] 💰 addTokens: ${prev.tokenBalance} + ${amount} = ${newBalance}`);
      return { ...prev, tokenBalance: newBalance };
    });
  }, []);

  const deductTokens = useCallback((amount: number) => {
    console.log('[AuthContext] deductTokens called:', amount);
    setUser((prev) => {
      if (!prev) return null;
      const newBalance = Math.max(0, prev.tokenBalance - amount);
      balanceRevRef.current = Date.now();
      console.log(`[AuthContext] 💰 deductTokens: ${prev.tokenBalance} - ${amount} = ${newBalance}`);
      return { ...prev, tokenBalance: newBalance };
    });
  }, []);
  
  // DEBUG: Kalan setUser çağrılarını yakala (olmamalı)
  // Not: addTokens ve deductTokens direkt setUser kullanıyor çünkü balance hesaplama yapıyorlar

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        token, 
        loading, 
        onboardingCompleted,
        instantBalance,
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
