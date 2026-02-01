/**
 * Feature Flags - Özellik kontrolleri
 * 
 * Kill switch ve feature toggle'lar için merkezi yapılandırma.
 * Production'da bu değerler environment variable veya database'den gelebilir.
 */

export const FEATURES = {
  // ============================================
  // JETON SİSTEMİ - ACİL DURUM KILL SWITCH
  // ============================================
  
  /**
   * Elmas hediye sistemi aktif mi?
   * false = Tüm elmas transferleri devre dışı
   * 
   * UYARI: Bakım/debug için false yapılabilir.
   * Production'da true olmalı.
   */
  TOKEN_GIFT_ENABLED: true, // ✅ AKTİF
  
  /**
   * Kullanıcıya gösterilecek bakım mesajı (sistem kapalıyken)
   */
  TOKEN_GIFT_DISABLED_MESSAGE: 'Elmas hediye sistemi şu an bakımda. Lütfen daha sonra tekrar deneyin.',
  
  // ============================================
  // DİĞER ÖZELLİKLER
  // ============================================
  
  /**
   * Medya görüntüleme (token harcama) aktif mi?
   */
  MEDIA_VIEW_ENABLED: true,
  
  /**
   * Prime satın alma aktif mi?
   */
  PRIME_PURCHASE_ENABLED: true,
  
  /**
   * Mock satın alma (test) aktif mi?
   * Production'da false olmalı.
   */
  MOCK_PURCHASE_ENABLED: true,
};

// İstek sayacı (metrik için)
export const METRICS = {
  tokenGiftAttempts: 0,
  tokenGiftBlocked: 0,
};

/**
 * Elmas hediye isteğini logla
 */
export function logTokenGiftAttempt(blocked: boolean = false) {
  METRICS.tokenGiftAttempts++;
  if (blocked) {
    METRICS.tokenGiftBlocked++;
  }
  console.log(`[METRICS] Token gift attempts: ${METRICS.tokenGiftAttempts}, blocked: ${METRICS.tokenGiftBlocked}`);
}

/**
 * Feature durumunu kontrol et
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature] === true;
}
