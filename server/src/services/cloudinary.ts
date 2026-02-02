/**
 * Cloudinary Service - Fotoğraf ve Video Yükleme
 * 
 * Kurulum:
 * 1. https://cloudinary.com adresinden hesap aç
 * 2. Dashboard'dan API bilgilerini al
 * 3. .env dosyasına ekle:
 *    CLOUDINARY_CLOUD_NAME=xxx
 *    CLOUDINARY_API_KEY=xxx
 *    CLOUDINARY_API_SECRET=xxx
 */

import { v2 as cloudinary } from 'cloudinary';

// Cloudinary yapılandırması
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

/**
 * Cloudinary yapılandırılmış mı kontrol et
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Base64 veya buffer'dan fotoğraf yükle
 */
export async function uploadImage(
  fileBuffer: Buffer | string,
  folder: string = 'cardmatch',
  options: { transformation?: any } = {}
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    console.log('[Cloudinary] Not configured, skipping upload');
    return { success: false, error: 'Cloudinary yapılandırılmamış' };
  }

  try {
    // Buffer'ı base64'e çevir
    const base64Data = Buffer.isBuffer(fileBuffer)
      ? `data:image/jpeg;base64,${fileBuffer.toString('base64')}`
      : fileBuffer;

    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'image',
      transformation: options.transformation || [
        { width: 1080, height: 1080, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    });

    console.log(`[Cloudinary] Image uploaded: ${result.public_id}`);
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error: any) {
    console.error('[Cloudinary] Upload error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Video yükle
 */
export async function uploadVideo(
  fileBuffer: Buffer | string,
  folder: string = 'cardmatch/videos'
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    console.log('[Cloudinary] Not configured, skipping upload');
    return { success: false, error: 'Cloudinary yapılandırılmamış' };
  }

  try {
    const base64Data = Buffer.isBuffer(fileBuffer)
      ? `data:video/mp4;base64,${fileBuffer.toString('base64')}`
      : fileBuffer;

    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'video',
      transformation: [
        { width: 720, crop: 'limit' },
        { quality: 'auto:good' },
      ],
    });

    console.log(`[Cloudinary] Video uploaded: ${result.public_id}`);
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error: any) {
    console.error('[Cloudinary] Video upload error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Dosya sil
 */
export async function deleteFile(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<boolean> {
  if (!isCloudinaryConfigured()) {
    return false;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`[Cloudinary] Deleted: ${publicId}`);
    return true;
  } catch (error: any) {
    console.error('[Cloudinary] Delete error:', error.message);
    return false;
  }
}

/**
 * Dosya yolundan yükle (sunucudaki dosya)
 */
export async function uploadFromPath(
  filePath: string,
  folder: string = 'cardmatch',
  resourceType: 'image' | 'video' = 'image'
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    console.log('[Cloudinary] Not configured, skipping upload');
    return { success: false, error: 'Cloudinary yapılandırılmamış' };
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: resourceType,
    });

    console.log(`[Cloudinary] File uploaded from path: ${result.public_id}`);
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error: any) {
    console.error('[Cloudinary] Upload from path error:', error.message);
    return { success: false, error: error.message };
  }
}

export { cloudinary };
