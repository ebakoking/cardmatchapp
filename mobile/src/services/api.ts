import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { apiUrl } = (Constants.expoConfig?.extra || {}) as {
  apiUrl?: string;
};

export const api = axios.create({
  baseURL: apiUrl || 'http://localhost:3000',
});

// Token'ı her istekte header'a ekle
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.log('Error getting token from AsyncStorage:', error);
  }
  return config;
});

// Hata interceptor'ı
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 hatalarını logla
    if (error.response?.status === 401) {
      console.log('Unauthorized request:', error.config?.url);
    }
    return Promise.reject(error);
  }
);
