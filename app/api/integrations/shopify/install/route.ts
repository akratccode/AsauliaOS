import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shop = url.searchParams.get('shop');
  if (!shop) {
    return NextResponse.json({ error: 'missing_shop' }, { status: 400 });
  }
  if (!env.SHOPIFY_APP_API_KEY || !env.SHOPIFY_APP_SCOPES) {
    return NextResponse.json({ error: 'shopify_not_configured' }, { status: 503 });
  }
  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/integrations/shopify/callback`;
  const target = new URL(`https://${shop}/admin/oauth/authorize`);
  target.searchParams.set('client_id', env.SHOPIFY_APP_API_KEY);
  target.searchParams.set('scope', env.SHOPIFY_APP_SCOPES);
  target.searchParams.set('redirect_uri', redirectUri);
  target.searchParams.set('state', shop);
  return NextResponse.redirect(target.toString());
}
