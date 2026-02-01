/**
 * CardMatch Avatar Listesi
 * Tüm ekranlarda tutarlı avatar gösterimi için tek kaynak
 * Modern chat/dating uygulamasına uygun 8 avatar
 */

export interface Avatar {
  id: number;
  emoji: string;
  color: string;
  name: string;
}

export const AVATARS: Avatar[] = [
  { id: 1, emoji: '😎', color: '#6C5CE7', name: 'Cool' },
  { id: 2, emoji: '🔥', color: '#E84393', name: 'Ateşli' },
  { id: 3, emoji: '💜', color: '#9B59B6', name: 'Mor Kalp' },
  { id: 4, emoji: '⭐', color: '#F39C12', name: 'Yıldız' },
  { id: 5, emoji: '🌙', color: '#2C3E50', name: 'Gece' },
  { id: 6, emoji: '💎', color: '#3498DB', name: 'Elmas' },
  { id: 7, emoji: '🎭', color: '#E74C3C', name: 'Gizemli' },
  { id: 8, emoji: '✨', color: '#1ABC9C', name: 'Parıltı' },
];

/**
 * Avatar ID'sine göre avatar bilgisini döndürür
 * Bulunamazsa varsayılan avatarı döndürür
 */
export const getAvatar = (avatarId: number = 1): Avatar => {
  return AVATARS.find(a => a.id === avatarId) || AVATARS[0];
};

/**
 * Varsayılan avatar
 */
export const DEFAULT_AVATAR = AVATARS[0];
