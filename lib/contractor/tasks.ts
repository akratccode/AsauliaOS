import 'server-only';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { DeliverableStatus, DeliverableType } from '@/lib/deliverables/types';

export type ContractorTaskRow = {
  id: string;
  title: string;
  type: DeliverableType;
  status: DeliverableStatus;
  dueDate: string | null;
  fixedShareBps: number;
  brandId: string;
  brandName: string;
  planFixedCents: number | null;
  planVariableBps: number | null;
};

export type TaskFilters = {
  brandId?: string | null;
  status?: DeliverableStatus[] | null;
  type?: DeliverableType | null;
};

export async function listContractorTasks(
  contractorUserId: string,
  filters: TaskFilters = {},
): Promise<ContractorTaskRow[]> {
  const conds = [
    eq(schema.deliverables.assigneeUserId, contractorUserId),
    isNull(schema.deliverables.archivedAt),
  ];
  if (filters.brandId) conds.push(eq(schema.deliverables.brandId, filters.brandId));
  if (filters.type) conds.push(eq(schema.deliverables.type, filters.type));
  if (filters.status && filters.status.length > 0) {
    conds.push(inArray(schema.deliverables.status, filters.status));
  }

  const rows = await db
    .select({
      id: schema.deliverables.id,
      title: schema.deliverables.title,
      type: schema.deliverables.type,
      status: schema.deliverables.status,
      dueDate: schema.deliverables.dueDate,
      fixedShareBps: schema.deliverables.fixedShareBps,
      brandId: schema.deliverables.brandId,
      brandName: schema.brands.name,
    })
    .from(schema.deliverables)
    .innerJoin(schema.brands, eq(schema.deliverables.brandId, schema.brands.id))
    .where(and(...conds))
    .orderBy(asc(sql`coalesce(${schema.deliverables.dueDate}, '9999-12-31')`));

  if (rows.length === 0) return [];

  const brandIds = Array.from(new Set(rows.map((r) => r.brandId)));
  const plans = await db
    .select({
      brandId: schema.plans.brandId,
      fixedAmountCents: schema.plans.fixedAmountCents,
      variablePercentBps: schema.plans.variablePercentBps,
    })
    .from(schema.plans)
    .where(and(inArray(schema.plans.brandId, brandIds), isNull(schema.plans.effectiveTo)));
  const planByBrand = new Map(plans.map((p) => [p.brandId, p]));

  return rows.map((r) => ({
    ...r,
    planFixedCents: planByBrand.get(r.brandId)?.fixedAmountCents ?? null,
    planVariableBps: planByBrand.get(r.brandId)?.variablePercentBps ?? null,
  }));
}
