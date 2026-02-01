import Constants from 'expo-constants';

// API base URL for photo URLs
const API_BASE_URL = (Constants.expoConfig?.extra as any)?.apiUrl || 'http://192.168.1.3:3000';

/**
 * Convert relative photo URL to full URL
 * @param url - Relative or absolute URL
 * @returns Full URL with API base
 */
export const getPhotoUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

export default getPhotoUrl;
