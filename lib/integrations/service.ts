import 'server-only';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { Forbidden } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/rbac';
import { isStaff } from '@/lib/deliverables/service';
import { encryptConfig, decryptConfig } from './crypto';
import { getAdapter } from './registry';
import { classify } from './classify';
import type {
  AttributionRule,
  IntegrationProvider,
  NormalizedSale,
} from './types';

type ConnectParams = {
  brandId: string;
  provider: IntegrationProvider;
  payload: unknown;
  attributionRules?: AttributionRule[];
};

export async function connectIntegration(
  actor: AuthContext,
  params: ConnectParams,
): Promise<{ id: string }> {
  if (!isStaff(actor)) throw new Forbidden('Staff only');
  const adapter = getAdapter(params.provider);
  const result = await adapter.connect({ brandId: params.brandId, payload: params.payload });
  const configEncrypted = encryptConfig(result.config);

  const inserted = await db
    .insert(schema.salesIntegrations)
    .values({
      brandId: params.brandId,
      provider: params.provider,
      status: 'active',
      displayName: result.displayName,
      externalAccountId: result.externalAccountId,
      configEncrypted,
      attributionRules: params.attributionRules ?? [],
    })
    .returning({ id: schema.salesIntegrations.id });
  const row = inserted[0];
  if (!row) throw new Error('connectIntegration insert returned no rows');
  return row;
}

export async function updateIntegrationRules(
  actor: AuthContext,
  integrationId: string,
  rules: AttributionRule[],
): Promise<void> {
  if (!isStaff(actor)) throw new Forbidden('Staff only');
  await db
    .update(schema.salesIntegrations)
    .set({ attributionRules: rules, updatedAt: new Date() })
    .where(eq(schema.salesIntegrations.id, integrationId));
}

type IngestInput = {
  integrationId: string;
  sales: NormalizedSale[];
};

export async function ingestSales(input: IngestInput): Promise<{ inserted: number }> {
  if (input.sales.length === 0) return { inserted: 0 };
  const integration = await loadIntegration(input.integrationId);
  const rules = (integration.attributionRules ?? []) as AttributionRule[];

  const rows = input.sales.map((sale) => {
    const { attributed, reason } = classify(sale, rules);
    return {
      brandId: integration.brandId,
      integrationId: integration.id,
      externalId: sale.externalId,
      amountCents: sale.amountCents,
      currency: sale.currency.toUpperCase(),
      occurredAt: sale.occurredAt,
      attributed,
      attributionReason: reason,
      rawPayload: stripPii(sale.metadata),
    };
  });

  const inserted = await db
    .insert(schema.salesRecords)
    .values(rows)
    .onConflictDoNothing({
      target: [schema.salesRecords.integrationId, schema.salesRecords.externalId],
    })
    .returning({ id: schema.salesRecords.id });

  return { inserted: inserted.length };
}

export async function syncIntegration(integrationId: string): Promise<{ inserted: number }> {
  const integration = await loadIntegration(integrationId);
  const adapter = getAdapter(integration.provider);
  if (!integration.configEncrypted) {
    throw new Error(`Integration ${integrationId} has no stored config`);
  }
  const config = decryptConfig<unknown>(integration.configEncrypted);
  const since = integration.lastSyncedAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const sales = await adapter.pullSince({ config, since });
    const { inserted } = await ingestSales({ integrationId, sales });
    await db
      .update(schema.salesIntegrations)
      .set({ lastSyncedAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(schema.salesIntegrations.id, integrationId));
    return { inserted };
  } catch (err) {
    await db
      .update(schema.salesIntegrations)
      .set({
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(schema.salesIntegrations.id, integrationId));
    throw err;
  }
}

export async function reclassifyIntegration(
  actor: AuthContext,
  integrationId: string,
  periodStart: Date,
): Promise<{ updated: number }> {
  if (!isStaff(actor)) throw new Forbidden('Staff only');
  const integration = await loadIntegration(integrationId);
  const rules = (integration.attributionRules ?? []) as AttributionRule[];
  const rows = await db
    .select({
      id: schema.salesRecords.id,
      rawPayload: schema.salesRecords.rawPayload,
      amountCents: schema.salesRecords.amountCents,
      currency: schema.salesRecords.currency,
      occurredAt: schema.salesRecords.occurredAt,
      externalId: schema.salesRecords.externalId,
      attributed: schema.salesRecords.attributed,
    })
    .from(schema.salesRecords)
    .where(
      and(
        eq(schema.salesRecords.integrationId, integrationId),
        gte(schema.salesRecords.occurredAt, periodStart),
      ),
    );

  let updated = 0;
  for (const row of rows) {
    const sale: NormalizedSale = {
      externalId: row.externalId,
      amountCents: row.amountCents,
      currency: row.currency,
      occurredAt: row.occurredAt,
      metadata: (row.rawPayload ?? {}) as Record<string, unknown>,
    };
    const next = classify(sale, rules);
    if (next.attributed !== row.attributed) {
      await db
        .update(schema.salesRecords)
        .set({ attributed: next.attributed, attributionReason: next.reason })
        .where(eq(schema.salesRecords.id, row.id));
      updated += 1;
    }
  }
  return { updated };
}

export async function addManualSale(
  actor: AuthContext,
  input: {
    brandId: string;
    amountCents: number;
    currency: string;
    occurredAt: Date;
    description: string;
    attributionReason: string;
  },
): Promise<{ id: string }> {
  if (actor.globalRole !== 'admin') throw new Forbidden('Admin only for manual sales');

  const integration = await ensureManualIntegration(input.brandId);
  const inserted = await db
    .insert(schema.salesRecords)
    .values({
      brandId: input.brandId,
      integrationId: integration.id,
      externalId: `manual-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      amountCents: input.amountCents,
      currency: input.currency.toUpperCase(),
      occurredAt: input.occurredAt,
      attributed: true,
      attributionReason: input.attributionReason,
      rawPayload: { description: input.description },
    })
    .returning({ id: schema.salesRecords.id });

  const row = inserted[0];
  if (!row) throw new Error('addManualSale returned no rows');

  await db.insert(schema.auditLog).values({
    actorUserId: actor.userId,
    brandId: input.brandId,
    action: 'sales.manual_entry',
    entityType: 'sales_record',
    entityId: row.id,
    after: {
      amountCents: input.amountCents,
      currency: input.currency,
      reason: input.attributionReason,
    },
  });
  return row;
}

async function ensureManualIntegration(brandId: string) {
  const existing = await db
    .select()
    .from(schema.salesIntegrations)
    .where(
      and(
        eq(schema.salesIntegrations.brandId, brandId),
        eq(schema.salesIntegrations.provider, 'manual'),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(schema.salesIntegrations)
    .values({
      brandId,
      provider: 'manual',
      status: 'active',
      displayName: 'Manual entries',
      externalAccountId: `manual:${brandId}`,
      attributionRules: [{ type: 'all' }],
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error('ensureManualIntegration returned no rows');
  return row;
}

async function loadIntegration(integrationId: string) {
  const row = await db
    .select()
    .from(schema.salesIntegrations)
    .where(eq(schema.salesIntegrations.id, integrationId))
    .limit(1);
  if (!row[0]) throw new Error(`Integration ${integrationId} not found`);
  return row[0];
}

function stripPii(metadata: Record<string, unknown>): Record<string, unknown> {
  const drop = new Set(['email', 'customer_email', 'name', 'customer_name', 'phone']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (drop.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

export async function attributedSalesForPeriod(
  brandId: string,
  period: { start: Date; end: Date },
): Promise<{ totalCents: number; count: number }> {
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.salesRecords.amountCents}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.salesRecords)
    .where(
      and(
        eq(schema.salesRecords.brandId, brandId),
        eq(schema.salesRecords.attributed, true),
        gte(schema.salesRecords.occurredAt, period.start),
        lte(schema.salesRecords.occurredAt, period.end),
      ),
    );
  const row = rows[0];
  return { totalCents: row?.total ?? 0, count: row?.count ?? 0 };
}
