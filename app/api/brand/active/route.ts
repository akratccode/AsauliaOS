import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/rbac';
import { listUserBrands, ACTIVE_BRAND_COOKIE } from '@/lib/brand/context';

const schema = z.object({ brandId: z.string().uuid() });

export async function POST(req: Request) {
  const actor = await requireAuth();
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const brands = await listUserBrands(actor);
  if (!brands.find((b) => b.id === body.data.brandId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const store = await cookies();
  store.set(ACTIVE_BRAND_COOKIE, body.data.brandId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true });
}
