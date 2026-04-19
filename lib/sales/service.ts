import 'server-only';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export type SalesFilter = {
  brandId: string;
  integrationId?: string | null;
  attribution?: 'all' | 'attributed' | 'unattributed';
  minCents?: number;
  maxCents?: number;
  occurredFrom?: Date;
  occurredTo?: Date;
  page?: number;
  pageSize?: number;
};

export type SaleRow = {
  id: string;
  occurredAt: Date;
  amountCents: number;
  currency: string;
  attributed: boolean;
  attributionReason: string | null;
  externalId: string;
  integrationId: string;
  integrationName: string;
};

export type SalesListResult = {
  rows: SaleRow[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;

function buildFilters(filter: SalesFilter) {
  const conds = [eq(schema.salesRecords.brandId, filter.brandId)];
  if (filter.integrationId)
    conds.push(eq(schema.salesRecords.integrationId, filter.integrationId));
  if (filter.attribution === 'attributed')
    conds.push(eq(schema.salesRecords.attributed, true));
  if (filter.attribution === 'unattributed')
    conds.push(eq(schema.salesRecords.attributed, false));
  if (typeof filter.minCents === 'number')
    conds.push(gte(schema.salesRecords.amountCents, filter.minCents));
  if (typeof filter.maxCents === 'number')
    conds.push(lte(schema.salesRecords.amountCents, filter.maxCents));
  if (filter.occurredFrom)
    conds.push(gte(schema.salesRecords.occurredAt, filter.occurredFrom));
  if (filter.occurredTo)
    conds.push(lte(schema.salesRecords.occurredAt, filter.occurredTo));
  return conds;
}

export async function listSales(filter: SalesFilter): Promise<SalesListResult> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, filter.pageSize ?? DEFAULT_PAGE_SIZE);
  const conds = buildFilters(filter);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.salesRecords)
    .where(and(...conds));

  const rows = await db
    .select({
      id: schema.salesRecords.id,
      occurredAt: schema.salesRecords.occurredAt,
      amountCents: schema.salesRecords.amountCents,
      currency: schema.salesRecords.currency,
      attributed: schema.salesRecords.attributed,
      attributionReason: schema.salesRecords.attributionReason,
      externalId: schema.salesRecords.externalId,
      integrationId: schema.salesRecords.integrationId,
      integrationName: schema.salesIntegrations.displayName,
    })
    .from(schema.salesRecords)
    .innerJoin(
      schema.salesIntegrations,
      eq(schema.salesRecords.integrationId, schema.salesIntegrations.id),
    )
    .where(and(...conds))
    .orderBy(desc(schema.salesRecords.occurredAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows,
    total: countRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function listIntegrationsForBrand(brandId: string) {
  return db
    .select({
      id: schema.salesIntegrations.id,
      displayName: schema.salesIntegrations.displayName,
      provider: schema.salesIntegrations.provider,
      status: schema.salesIntegrations.status,
    })
    .from(schema.salesIntegrations)
    .where(eq(schema.salesIntegrations.brandId, brandId));
}

export function salesToCsv(rows: SaleRow[]): string {
  const header = [
    'occurred_at',
    'source',
    'amount_cents',
    'currency',
    'attributed',
    'reason',
    'external_id',
  ];
  const lines: string[] = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.occurredAt.toISOString(),
        csvEscape(r.integrationName),
        String(r.amountCents),
        r.currency,
        r.attributed ? 'true' : 'false',
        csvEscape(r.attributionReason ?? ''),
        csvEscape(r.externalId),
      ].join(','),
    );
  }
  return lines.join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function customerHash(externalId: string): string {
  // Deterministic short hash for anonymous identification without PII.
  let h = 0;
  for (let i = 0; i < externalId.length; i++) {
    h = (h * 31 + externalId.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).padStart(5, '0').slice(0, 5);
}
