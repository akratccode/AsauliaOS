import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

const COOKIE_NAME = 'asaulia_impersonate';
const MAX_AGE_SECONDS = 60 * 60 * 2;

export type ImpersonationPayload = {
  adminUserId: string;
  targetUserId: string;
  exp: number;
};

function sign(body: string): string {
  return createHmac('sha256', env.SUPABASE_SERVICE_ROLE_KEY).update(body).digest('base64url');
}

function encode(payload: ImpersonationPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decodeImpersonationCookie(raw: string | undefined): ImpersonationPayload | null {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  const expected = sign(body);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ImpersonationPayload;
    if (!payload.adminUserId || !payload.targetUserId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function writeImpersonationCookie(input: { adminUserId: string; targetUserId: string }) {
  const payload: ImpersonationPayload = {
    adminUserId: input.adminUserId,
    targetUserId: input.targetUserId,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const jar = await cookies();
  jar.set(COOKIE_NAME, encode(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearImpersonationCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function readImpersonationCookie(): Promise<ImpersonationPayload | null> {
  const jar = await cookies();
  return decodeImpersonationCookie(jar.get(COOKIE_NAME)?.value);
}
