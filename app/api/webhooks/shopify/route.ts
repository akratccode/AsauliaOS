import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { shopifyAdapter } from '@/lib/integrations/shopify';
import { decryptConfig } from '@/lib/integrations/crypto';
import { ingestSales } from '@/lib/integrations/service';

export async function POST(req: Request) {
  const shopDomain = req.headers.get('x-shopify-shop-domain');
  if (!shopDomain) {
    return NextResponse.json({ error: 'missing_shop_domain' }, { status: 400 });
  }

  const integrationRow = await db
    .select()
    .from(schema.salesIntegrations)
    .where(eq(schema.salesIntegrations.externalAccountId, shopDomain))
    .limit(1);
  const integration = integrationRow[0];
  if (!integration || !integration.configEncrypted) {
    return NextResponse.json({ error: 'integration_not_found' }, { status: 404 });
  }

  const body = await req.text();
  try {
    const config = decryptConfig<unknown>(integration.configEncrypted);
    const sales = await shopifyAdapter.handleWebhook!({
      config,
      headers: req.headers,
      body,
    });
    await ingestSales({ integrationId: integration.id, sales });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'invalid_hmac') {
      return NextResponse.json({ error: 'invalid_hmac' }, { status: 401 });
    }
    return NextResponse.json({ error: 'malformed_webhook' }, { status: 400 });
  }
}
