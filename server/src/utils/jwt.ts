import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Secrets (production'da env'den alınmalı)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret-dev';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev';

// Token süreleri
const ACCESS_TOKEN_EXPIRES = '15m';  // 15 dakika
const REFRESH_TOKEN_EXPIRES = '30d'; // 30 gün

// ============ TOKEN TİPLERİ ============

export interface AccessTokenPayload {
  userId: string;
  type: 'access';
  // identifier (phone/email) artık burada tutulmayacak - sadece userId
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
  tokenId: string; // Benzersiz token ID (iptal için)
}

export interface JwtPayload {
  userId: string;
  phoneNumber?: string;
  email?: string;
  isAdmin?: boolean;
}

// ============ ACCESS TOKEN ============

/**
 * Access Token oluştur (kısa ömürlü - 15 dakika)
 */
export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = {
    userId,
    type: 'access',
  };
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

/**
 * Access Token doğrula
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (decoded.type !== 'access') {
      throw new Error('INVALID_TOKEN_TYPE');
    }
    return decoded;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error('INVALID_TOKEN');
  }
}

// ============ REFRESH TOKEN ============

/**
 * Refresh Token oluştur (uzun ömürlü - 30 gün)
 */
export function signRefreshToken(userId: string): { token: string; tokenId: string; expiresAt: Date } {
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün
  
  const payload: RefreshTokenPayload = {
    userId,
    type: 'refresh',
    tokenId,
  };
  
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
  
  return { token, tokenId, expiresAt };
}

/**
 * Refresh Token doğrula
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') {
      throw new Error('INVALID_TOKEN_TYPE');
    }
    return decoded;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }
    throw new Error('INVALID_REFRESH_TOKEN');
  }
}

// ============ ESKİ UYUMLULUK (Geçiş dönemi için) ============

/**
 * Eski format JWT oluştur (geriye uyumluluk için)
 * @deprecated Yeni kod için signAccessToken kullanın
 */
export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

/**
 * Eski format JWT doğrula (geriye uyumluluk için)
 * @deprecated Yeni kod için verifyAccessToken kullanın
 */
export function verifyJwt(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error('INVALID_TOKEN');
  }
}

// ============ YARDIMCI FONKSİYONLAR ============

/**
 * Token tipini belirle
 */
export function getTokenType(token: string): 'access' | 'refresh' | 'unknown' {
  try {
    // İlk olarak access token olarak dene
    const decoded = jwt.decode(token) as any;
    if (decoded?.type === 'access') return 'access';
    if (decoded?.type === 'refresh') return 'refresh';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Token'ın süresinin dolmasına kalan süreyi hesapla (saniye)
 */
export function getTokenTTL(token: string): number {
  try {
    const decoded = jwt.decode(token) as any;
    if (decoded?.exp) {
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, decoded.exp - now);
    }
    return 0;
  } catch {
    return 0;
  }
}
