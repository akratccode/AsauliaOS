import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  if (!env.INTEGRATIONS_ENCRYPTION_KEY) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY is not set');
  }
  const buf = Buffer.from(env.INTEGRATIONS_ENCRYPTION_KEY, 'base64');
  if (buf.length !== 32) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY must decode to 32 bytes (base64)');
  }
  return buf;
}

export function encryptConfig(obj: unknown): Buffer {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(obj), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, data]);
}

export function decryptConfig<T>(buf: Buffer): T {
  const key = getKey();
  const iv = buf.subarray(0, IV_LEN);
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}
