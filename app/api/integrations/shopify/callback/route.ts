import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { requireRole } from '@/lib/auth/rbac';
import { connectIntegration } from '@/lib/integrations/service';

export async function GET(req: Request) {
  const actor = await requireRole(['admin', 'operator']);
  const url = new URL(req.url);
  const shop = url.searchParams.get('shop');
  const code = url.searchParams.get('code');
  const brandId = url.searchParams.get('brandId');
  if (!shop || !code || !brandId) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  if (!env.SHOPIFY_APP_API_KEY || !env.SHOPIFY_APP_API_SECRET) {
    return NextResponse.json({ error: 'shopify_not_configured' }, { status: 503 });
  }
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.SHOPIFY_APP_API_KEY,
      client_secret: env.SHOPIFY_APP_API_SECRET,
      code,
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'token_exchange_failed' }, { status: 502 });
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  await connectIntegration(actor, {
    brandId,
    provider: 'shopify',
    payload: { shop, accessToken: access_token },
    attributionRules: [{ type: 'all' }],
  });
  return NextResponse.redirect(
    `${env.NEXT_PUBLIC_APP_URL}/admin/brands/${brandId}/integrations`,
  );
}
