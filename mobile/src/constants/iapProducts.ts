import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra as Record<string, unknown>) || {};
const overrides = (extra.iapProductIds as Record<string, string>) || {};

/**
 * App Store Connect'te tanımlı ürün ID'leri (birebir aynı olmalı).
 * app.config.js > extra.iapProductIds ile override edilebilir (.env: EXPO_PUBLIC_IAP_DIAMOND_50 vb.).
 */
export const IAP_PRODUCT_IDS = {
  DIAMOND_50: overrides.diamond_50 || 'com.cardmatch.app.tokens_50',
  DIAMOND_100: overrides.diamond_100 || 'com.cardmatch.app.tokens_100',
  DIAMOND_250: overrides.diamond_250 || 'com.cardmatch.app.tokens_250',
  BOOST_1H: overrides.boost_1h || 'com.cardmatch.app.boost_1h',
  PRIME_WEEKLY: overrides.prime_weekly || 'com.cardmatch.app.prime_weekly2',
  PRIME_MONTHLY: overrides.prime_monthly || 'com.cardmatch.app.prime_monthly',
  PRIME_YEARLY: overrides.prime_yearly || 'com.cardmatch.app.prime_yearly2',
} as const;

/** Elmas paket id (UI) -> App Store product ID */
export const DIAMOND_PACKAGE_TO_PRODUCT_ID: Record<string, string> = {
  diamond_50: IAP_PRODUCT_IDS.DIAMOND_50,
  diamond_100: IAP_PRODUCT_IDS.DIAMOND_100,
  diamond_250: IAP_PRODUCT_IDS.DIAMOND_250,
};

/** Elmas product ID -> miktar */
export const DIAMOND_PRODUCT_TO_AMOUNT: Record<string, number> = {
  [IAP_PRODUCT_IDS.DIAMOND_50]: 50,
  [IAP_PRODUCT_IDS.DIAMOND_100]: 100,
  [IAP_PRODUCT_IDS.DIAMOND_250]: 250,
};

/** Elmas miktar -> product ID (FriendChat satın alma modalı için) */
export const DIAMOND_AMOUNT_TO_PRODUCT_ID: Record<number, string> = {
  50: IAP_PRODUCT_IDS.DIAMOND_50,
  100: IAP_PRODUCT_IDS.DIAMOND_100,
  250: IAP_PRODUCT_IDS.DIAMOND_250,
};

/** Prime paket id (UI) -> App Store product ID */
export const PRIME_PACKAGE_TO_PRODUCT_ID: Record<string, string> = {
  weekly: IAP_PRODUCT_IDS.PRIME_WEEKLY,
  monthly: IAP_PRODUCT_IDS.PRIME_MONTHLY,
  yearly: IAP_PRODUCT_IDS.PRIME_YEARLY,
};

export const ALL_IAP_SKUS = [
  IAP_PRODUCT_IDS.DIAMOND_50,
  IAP_PRODUCT_IDS.DIAMOND_100,
  IAP_PRODUCT_IDS.DIAMOND_250,
  IAP_PRODUCT_IDS.BOOST_1H,
  IAP_PRODUCT_IDS.PRIME_WEEKLY,
  IAP_PRODUCT_IDS.PRIME_MONTHLY,
  IAP_PRODUCT_IDS.PRIME_YEARLY,
];
