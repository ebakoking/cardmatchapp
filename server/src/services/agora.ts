import crypto from 'crypto';

const AGORA_APP_ID = process.env.AGORA_APP_ID || '';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';

// Basic Agora token generation for RTC (single user)
// Uses dynamic key 2.1 method (simplified for MVP).

const VERSION = '006';

function packUint16(num: number) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(num, 0);
  return buf;
}

function packUint32(num: number) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(num, 0);
  return buf;
}

export function generateAgoraToken(
  channelName: string,
  uid: string | number,
  expireSeconds: number,
): string {
  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    throw new Error('AGORA_CREDENTIALS_MISSING');
  }

  const ts = Math.floor(Date.now() / 1000);
  const expire = ts + expireSeconds;
  const randomInt = Math.floor(Math.random() * 0xffffffff);

  const serviceType = 1; // RTC
  const privileges = [
    {
      id: 1, // Join channel
      expire,
    },
  ];

  const service = Buffer.concat([
    Buffer.from([serviceType]),
    packUint16(channelName.length),
    Buffer.from(channelName),
    packUint32(+uid),
    packUint16(privileges.length),
    ...privileges.map((p) =>
      Buffer.concat([packUint16(p.id), packUint32(p.expire)]),
    ),
  ]);

  const salt = randomInt;
  const tsBuf = packUint32(ts);
  const saltBuf = packUint32(salt);

  const signing = Buffer.concat([
    Buffer.from(AGORA_APP_ID),
    Buffer.from(channelName),
    Buffer.from(String(uid)),
    saltBuf,
    tsBuf,
    service,
  ]);

  const signature = crypto
    .createHmac('sha256', AGORA_APP_CERTIFICATE)
    .update(signing)
    .digest();

  const content = Buffer.concat([
    packUint32(salt),
    tsBuf,
    packUint16(service.length),
    service,
  ]);

  const token = Buffer.concat([
    Buffer.from(VERSION),
    Buffer.from(AGORA_APP_ID),
    Buffer.from(signature.toString('hex')),
    content,
  ]).toString('base64');

  return token;
}

