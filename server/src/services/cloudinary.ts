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

interface VideoUploadResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  videoPublicId?: string;
  thumbnailPublicId?: string;
  duration?: number;
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
    // ✅ BUFFER VALIDATION
    if (Buffer.isBuffer(fileBuffer) && fileBuffer.length === 0) {
      console.error('[Cloudinary] ❌ Buffer is empty');
      return { success: false, error: 'Dosya bozuk (boş buffer)' };
    }

    // Buffer'ı base64'e çevir
    const base64Data = Buffer.isBuffer(fileBuffer)
      ? `data:image/jpeg;base64,${fileBuffer.toString('base64')}`
      : fileBuffer;

    console.log('[Cloudinary] Uploading image:', {
      folder,
      bufferSize: Buffer.isBuffer(fileBuffer) ? fileBuffer.length : 'N/A',
      hasTransformation: !!options.transformation,
    });

    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'image',
      transformation: options.transformation || [
        { width: 1080, height: 1080, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    });

    console.log(`[Cloudinary] ✅ Image uploaded: ${result.public_id}, URL: ${result.secure_url}`);
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error: any) {
    console.error('[Cloudinary] ❌ Upload error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Video yükle (legacy - geriye uyumluluk için)
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
 * 🎬 Video + Thumbnail yükle (yeni fonksiyon)
 */
export async function uploadVideoWithThumbnail(
  videoBuffer: Buffer,
  thumbnailBuffer: Buffer,
  folder: string = 'cardmatch/videos'
): Promise<VideoUploadResult> {
  if (!isCloudinaryConfigured()) {
    console.log('[Cloudinary] Not configured, skipping upload');
    return { success: false, error: 'Cloudinary yapılandırılmamış' };
  }

  try {
    // 1. Video yükle
    const videoBase64 = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;
    const videoResult = await cloudinary.uploader.upload(videoBase64, {
      folder,
      resource_type: 'video',
      transformation: [
        { width: 720, crop: 'limit' },
        { quality: 'auto:good' },
      ],
    });

    console.log(`[Cloudinary] Video uploaded: ${videoResult.public_id}`);

    // 2. Thumbnail yükle
    const thumbBase64 = `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
    const thumbResult = await cloudinary.uploader.upload(thumbBase64, {
      folder: `${folder}/thumbnails`,
      resource_type: 'image',
      transformation: [
        { width: 640, crop: 'limit' },
        { quality: 80 },
      ],
    });

    console.log(`[Cloudinary] Thumbnail uploaded: ${thumbResult.public_id}`);

    return {
      success: true,
      videoUrl: videoResult.secure_url,
      thumbnailUrl: thumbResult.secure_url,
      videoPublicId: videoResult.public_id,
      thumbnailPublicId: thumbResult.public_id,
      duration: videoResult.duration,
    };
  } catch (error: any) {
    console.error('[Cloudinary] Video+Thumbnail upload error:', error.message);
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
