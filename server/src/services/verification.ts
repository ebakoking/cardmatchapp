import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../prisma';

const bucket = process.env.AWS_S3_BUCKET || '';

const s3 =
  bucket &&
  new S3Client({
    region: process.env.AWS_REGION || 'eu-central-1',
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

export async function saveVerificationVideo(
  userId: string,
  fileBuffer: Buffer,
  mimeType: string,
) {
  const key = `verification-videos/${userId}-${Date.now()}.mp4`;

  if (!s3 || !bucket) {
    // Local / no-S3 fallback: mark URL as local path
    const url = `/uploads/${key}`;
    await prisma.verificationVideo.upsert({
      where: { userId },
      update: { url },
      create: { userId, url },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: 'PENDING' },
    });
    return url;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: 'private',
    }),
  );

  const url = `s3://${bucket}/${key}`;

  await prisma.verificationVideo.upsert({
    where: { userId },
    update: { url },
    create: { userId, url },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { verificationStatus: 'PENDING' },
  });

  return url;
}

