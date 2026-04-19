import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db, schema } from '@/lib/db';
import { syncIntegration } from '@/lib/integrations/service';

export async function POST(req: Request) {
  const header = req.headers.get('x-cron-secret');
  if (!env.CRON_SECRET || header !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const active = await db
    .select({ id: schema.salesIntegrations.id, provider: schema.salesIntegrations.provider })
    .from(schema.salesIntegrations)
    .where(eq(schema.salesIntegrations.status, 'active'));

  const results: Array<{
    id: string;
    provider: string;
    inserted?: number;
    error?: string;
  }> = [];
  for (const integration of active) {
    if (integration.provider === 'manual') continue;
    try {
      const { inserted } = await syncIntegration(integration.id);
      results.push({ id: integration.id, provider: integration.provider, inserted });
    } catch (err) {
      results.push({
        id: integration.id,
        provider: integration.provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return NextResponse.json({ results });
}

export const GET = POST;
