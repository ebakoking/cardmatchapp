import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { uploadImage, uploadVideo, uploadVideoWithThumbnail, isCloudinaryConfigured } from '../services/cloudinary';
import { generateVideoThumbnail, getVideoDuration } from '../services/videoThumbnail';

const router = Router();

// Uploads klasörünü oluştur (fallback için)
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer - memory storage (Cloudinary için)
const memoryStorage = multer.memoryStorage();

// Multer - disk storage (fallback için)
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.m4a';
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'audio/m4a',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-m4a',
    'audio/aac',
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/quicktime',
  ];
  
  if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error(`Desteklenmeyen dosya türü: ${file.mimetype}`));
  }
};

// Cloudinary varsa memory, yoksa disk storage kullan
const upload = multer({
  storage: isCloudinaryConfigured() ? memoryStorage : diskStorage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// POST /api/upload/audio - Ses dosyası yükle
router.post('/audio', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    let fileUrl: string;

    if (isCloudinaryConfigured() && req.file.buffer) {
      // Cloudinary'e yükle
      const result = await uploadVideo(req.file.buffer, 'cardmatch/audio');
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Yükleme başarısız' });
      }
      fileUrl = result.url!;
    } else {
      // Local storage
      const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
      fileUrl = `${baseUrl}/uploads/${(req.file as any).filename}`;
    }

    console.log('[Upload] Audio uploaded:', { url: fileUrl });

    return res.json({
      success: true,
      url: fileUrl,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return res.status(500).json({ error: 'Dosya yüklenemedi' });
  }
});

// POST /api/upload/photo - Fotoğraf yükle
router.post('/photo', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    let fileUrl: string;

    if (isCloudinaryConfigured() && req.file.buffer) {
      // Cloudinary'e yükle
      const result = await uploadImage(req.file.buffer, 'cardmatch/photos');
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Yükleme başarısız' });
      }
      fileUrl = result.url!;
    } else {
      // Local storage
      const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
      fileUrl = `${baseUrl}/uploads/${(req.file as any).filename}`;
    }

    console.log('[Upload] Photo uploaded:', { url: fileUrl });

    return res.json({
      success: true,
      url: fileUrl,
      filename: req.file.originalname,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return res.status(500).json({ error: 'Dosya yüklenemedi' });
  }
});

// POST /api/upload/video - Video yükle (🎬 Thumbnail ile)
router.post('/video', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    let fileUrl: string;
    let thumbnailUrl: string | undefined;
    let duration: number | undefined;

    if (isCloudinaryConfigured() && req.file.buffer) {
      // 🎬 Thumbnail generate et
      console.log('[Upload] Generating video thumbnail...');
      const thumbnailBuffer = await generateVideoThumbnail(req.file.buffer, 1);

      // Duration al
      try {
        duration = await getVideoDuration(req.file.buffer);
        console.log('[Upload] Video duration:', duration, 'seconds');
      } catch (err) {
        console.warn('[Upload] Could not get video duration:', err);
      }

      // Cloudinary'e video + thumbnail yükle
      const result = await uploadVideoWithThumbnail(
        req.file.buffer,
        thumbnailBuffer,
        'cardmatch/videos'
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Yükleme başarısız' });
      }

      fileUrl = result.videoUrl!;
      thumbnailUrl = result.thumbnailUrl;
      duration = result.duration || duration;

      console.log('[Upload] Video + Thumbnail uploaded:', {
        video: fileUrl,
        thumbnail: thumbnailUrl,
        duration,
      });
    } else {
      // Local storage (sadece video, thumbnail generate yok)
      const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
      fileUrl = `${baseUrl}/uploads/${(req.file as any).filename}`;
      console.log('[Upload] Video uploaded (local, no thumbnail):', { url: fileUrl });
    }

    return res.json({
      success: true,
      url: fileUrl,
      thumbnailUrl, // 🎬 Thumbnail URL
      duration,
      filename: req.file.originalname,
    });
  } catch (error) {
    console.error('[Upload] Video upload error:', error);
    return res.status(500).json({ error: 'Video yüklenemedi' });
  }
});

export default router;
