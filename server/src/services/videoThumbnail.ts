import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Video'dan thumbnail oluşturur
 * @param videoBuffer - Video dosyasının buffer'ı
 * @param timeInSeconds - Thumbnail alınacak saniye (default: 1)
 * @returns Thumbnail buffer (JPEG)
 */
export async function generateVideoThumbnail(
  videoBuffer: Buffer,
  timeInSeconds: number = 1,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tempVideoPath = path.join(os.tmpdir(), `video-${uuidv4()}.mp4`);
    const tempThumbPath = path.join(os.tmpdir(), `thumb-${uuidv4()}.jpg`);

    try {
      // Video buffer'ı geçici dosyaya yaz
      fs.writeFileSync(tempVideoPath, videoBuffer);

      // FFmpeg ile thumbnail oluştur
      ffmpeg(tempVideoPath)
        .screenshots({
          timestamps: [timeInSeconds],
          filename: path.basename(tempThumbPath),
          folder: os.tmpdir(),
          size: '640x?', // Width 640px, height otomatik
        })
        .on('end', async () => {
          try {
            // Thumbnail'i oku ve optimize et
            const thumbBuffer = fs.readFileSync(tempThumbPath);

            // Sharp ile optimize et (JPEG, quality 80)
            const optimizedThumb = await sharp(thumbBuffer)
              .jpeg({ quality: 80, progressive: true })
              .resize(640, null, { withoutEnlargement: true })
              .toBuffer();

            // Geçici dosyaları temizle
            fs.unlinkSync(tempVideoPath);
            fs.unlinkSync(tempThumbPath);

            resolve(optimizedThumb);
          } catch (error) {
            console.error('[VideoThumbnail] Optimization error:', error);
            // Geçici dosyaları temizle
            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
            if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error('[VideoThumbnail] FFmpeg error:', err);
          // Geçici dosyaları temizle
          if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
          if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
          reject(err);
        });
    } catch (error) {
      console.error('[VideoThumbnail] Error:', error);
      // Geçici dosyaları temizle
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
      reject(error);
    }
  });
}

/**
 * Video duration'ı alır (saniye cinsinden)
 * @param videoBuffer - Video dosyasının buffer'ı
 * @returns Duration (seconds)
 */
export async function getVideoDuration(videoBuffer: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    const tempVideoPath = path.join(os.tmpdir(), `video-${uuidv4()}.mp4`);

    try {
      fs.writeFileSync(tempVideoPath, videoBuffer);

      ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
        // Geçici dosyayı temizle
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);

        if (err) {
          console.error('[VideoThumbnail] FFprobe error:', err);
          reject(err);
          return;
        }

        const duration = metadata.format.duration || 0;
        resolve(duration);
      });
    } catch (error) {
      console.error('[VideoThumbnail] Duration error:', error);
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      reject(error);
    }
  });
}
