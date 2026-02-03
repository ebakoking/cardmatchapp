import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const { apiUrl } = (Constants.expoConfig?.extra || {}) as {
  apiUrl?: string;
};

// API_URL .env dosyasından okunur
if (!apiUrl) {
  console.error('❌ API_URL tanımlı değil! .env dosyasını kontrol edin.');
}

const MAX_CONCURRENT_REQUESTS = 10;
let activeRequests = 0;
const requestQueue: Array<() => void> = [];

function runWhenAllowed<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      activeRequests++;
      try {
        const result = await fn();
        resolve(result);
      } catch (e) {
        reject(e);
      } finally {
        activeRequests--;
        if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
          const next = requestQueue.shift();
          if (next) next();
        }
      }
    };
    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
      run();
    } else {
      requestQueue.push(run);
    }
  });
}

const axiosInstance = axios.create({
  baseURL: apiUrl || '',
});

export const api = {
  get: <T = unknown>(url: string, config?: Parameters<typeof axiosInstance.get>[1]) =>
    runWhenAllowed(() => axiosInstance.get<T>(url, config)),
  post: <T = unknown>(url: string, data?: unknown, config?: Parameters<typeof axiosInstance.post>[2]) =>
    runWhenAllowed(() => axiosInstance.post<T>(url, data, config)),
  put: <T = unknown>(url: string, data?: unknown, config?: Parameters<typeof axiosInstance.put>[2]) =>
    runWhenAllowed(() => axiosInstance.put<T>(url, data, config)),
  patch: <T = unknown>(url: string, data?: unknown, config?: Parameters<typeof axiosInstance.patch>[2]) =>
    runWhenAllowed(() => axiosInstance.patch<T>(url, data, config)),
  delete: <T = unknown>(url: string, config?: Parameters<typeof axiosInstance.delete>[1]) =>
    runWhenAllowed(() => axiosInstance.delete<T>(url, config)),
  request: <T = unknown>(config: Parameters<typeof axiosInstance.request>[0]) =>
    runWhenAllowed(() => axiosInstance.request<T>(config)),
  interceptors: axiosInstance.interceptors,
  defaults: axiosInstance.defaults,
};

// 🚨 DEBUG: /api/auth/me spam'ini tespit et
let authMeCallCount = 0;
let lastAuthMeTime = 0;
let lastSuccessfulAuthMe = 0; // Başarılı çağrı zamanı

// Token yenilendiğinde throttle'ı resetle
export const resetAuthMeThrottle = () => {
  console.log('🔄 API: /auth/me throttle RESET');
  lastAuthMeTime = 0;
  authMeCallCount = 0;
};

// Token'ı her istekte header'a ekle - SecureStore kullan (AuthContext ile uyumlu)
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 🚨 /api/auth/me çağrılarını LOGLA (engelleme KALDIRILDI - login sorununa neden oluyordu)
    if (config.url?.includes('/auth/me')) {
      authMeCallCount++;
      const now = Date.now();
      const timeSinceLast = now - lastAuthMeTime;
      
      console.log(`🔵 API: /auth/me call #${authMeCallCount}, ${timeSinceLast}ms since last`);
      lastAuthMeTime = now;
      
      // NOT: Engelleme kaldırıldı çünkü token refresh sonrası retry'ı engelliyor
      // ve kullanıcıyı logout ediyordu. Throttle artık AuthContext içinde yapılıyor.
    }
  } catch (error) {
    console.log('Error getting token from SecureStore:', error);
  }
  // FormData ile yükleme: Content-Type'ı KALDIR ki runtime boundary ile ayarlasın (profil fotoğrafı vb.)
  if (config.data instanceof FormData) {
    delete (config.headers as any)['Content-Type'];
  }
  return config;
});

// Hata interceptor'ı - geliştirilmiş hata mesajları
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    
    // Network hatası kontrolü (İnternet yok)
    if (!error.response && error.message === 'Network Error') {
      console.log('🔴 API: Network error - no internet connection');
      error.userMessage = 'İnternet bağlantısı yok. Lütfen bağlantını kontrol et.';
    }
    
    // Timeout hatası
    if (error.code === 'ECONNABORTED') {
      console.log('🔴 API: Request timeout');
      error.userMessage = 'Bağlantı zaman aşımına uğradı. Lütfen tekrar dene.';
    }
    
    // Server hatası
    if (status >= 500) {
      console.log('🔴 API: Server error', status);
      error.userMessage = 'Sunucu hatası. Lütfen daha sonra tekrar dene.';
    }
    
    // 401 hatalarını sessizce handle et (boost, media gibi endpoint'ler için)
    const silentEndpoints = ['/api/boost/', '/api/media/'];
    const isSilentEndpoint = silentEndpoints.some(ep => url.includes(ep));
    
    if (status === 401 && !isSilentEndpoint) {
      console.log('Unauthorized request:', url);
    }
    
    return Promise.reject(error);
  }
);
