// ============================================
// CARDMATCH RENK PALETİ
// Logo: Kart + Zincir Bağ (Concept 3)
// ============================================

export const COLORS = {
  // === BACKGROUND (Logo arka planı) ===
  background: '#0d0d1f',         // Koyu lacivert
  surface: '#1a1a2e',            // Kart/modal arka planı
  surfaceLight: '#252542',       // Hover durumları
  
  // === PRIMARY - KART RENGİ (Logodaki mor kartlar) ===
  primary: '#5b5b99',            // Ana mor/indigo (kartlar)
  primaryLight: '#7575b3',       // Açık varyant
  primaryDark: '#4a4a7a',        // Koyu varyant
  
  // === ACCENT - ZİNCİR RENGİ (Logodaki cyan bağlantı) ===
  accent: '#7dd4d4',             // Cyan (zincir bağ)
  accentLight: '#9de5e5',        // Açık cyan
  accentDark: '#5fbfbf',         // Koyu cyan
  
  // === TEXT ===
  text: '#ffffff',               // Ana metin - beyaz
  textSecondary: '#e0e0f0',      // İkincil metin
  textMuted: '#8888aa',          // Soluk metin
  textDisabled: '#505070',       // Disabled metin
  
  // === DURUM RENKLERİ ===
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  danger: '#f87171',
  
  // === BORDER ===
  border: '#2a2a4a',
  borderLight: '#3a3a5a',
  divider: '#1f1f35',
  
  // === GRADIENTS ===
  gradientBackground: ['#0d0d1f', '#1a1a2e', '#0d0d1f'] as const,
  gradientPrimary: ['#4a4a7a', '#5b5b99'] as const,
  gradientAccent: ['#5fbfbf', '#7dd4d4'] as const,
  
  // === ÖZEL ===
  overlay: 'rgba(13, 13, 31, 0.85)',
  shadow: '#000000',
  transparent: 'transparent',
};
