import 'server-only';
import { and, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { computeSplit, distributeContractorPool, quote } from '@/lib/pricing';
import { attributedSalesForPeriod } from '@/lib/integrations/service';

export type BrandEarning = {
  brandId: string;
  brandName: string;
  fixedSharePoolCents: number;
  myFixedShareCents: number;
  variablePoolCents: number;
  myVariableShareCents: number;
  totalCents: number;
  contributingDeliverableIds: string[];
  attributedSalesCents: number;
  plan: { fixedAmountCents: number; variablePercentBps: number } | null;
};

export type ProjectionResult = {
  byBrand: BrandEarning[];
  totalCents: number;
  fixedTotalCents: number;
  variableTotalCents: number;
};

export async function projectEarningsForPeriod(
  userId: string,
  period: { start: Date; end: Date },
): Promise<ProjectionResult> {
  // Brands this contractor is active on this period.
  const brandRows = await db
    .select({
      id: schema.brands.id,
      name: schema.brands.name,
    })
    .from(schema.brandContractors)
    .innerJoin(schema.brands, eq(schema.brandContractors.brandId, schema.brands.id))
    .where(
      and(
        eq(schema.brandContractors.contractorUserId, userId),
        or(
          isNull(schema.brandContractors.endedAt),
          gte(schema.brandContractors.endedAt, period.start),
        ),
      ),
    );

  const result: BrandEarning[] = [];
  let fixedTotal = 0;
  let variableTotal = 0;

  for (const brand of brandRows) {
    const [plan] = await db
      .select()
      .from(schema.plans)
      .where(
        and(
          eq(schema.plans.brandId, brand.id),
          sql`${schema.plans.effectiveFrom} <= ${period.end}`,
          or(
            isNull(schema.plans.effectiveTo),
            sql`${schema.plans.effectiveTo} > ${period.start}`,
          ),
        ),
      )
      .orderBy(sql`${schema.plans.effectiveFrom} desc`)
      .limit(1);

    const sales = await attributedSalesForPeriod(brand.id, period);

    const q = plan
      ? quote({
          fixedAmountCents: plan.fixedAmountCents,
          variablePercentBps: plan.variablePercentBps,
          attributedSalesCents: sales.totalCents,
        })
      : null;

    const split = q
      ? computeSplit({
          fixedAmountCents: q.fixedAmountCents,
          variableAmountCents: q.variableAmountCents,
        })
      : null;

    // Contractors currently assigned to this brand (equal-split for variable).
    const contractorRows = await db
      .selectDistinct({ userId: schema.brandContractors.contractorUserId })
      .from(schema.brandContractors)
      .where(
        and(
          eq(schema.brandContractors.brandId, brand.id),
          or(
            isNull(schema.brandContractors.endedAt),
            gte(schema.brandContractors.endedAt, period.start),
          ),
        ),
      );

    const deliverableRows = await db
      .select({
        id: schema.deliverables.id,
        assigneeUserId: schema.deliverables.assigneeUserId,
        fixedShareBps: schema.deliverables.fixedShareBps,
        status: schema.deliverables.status,
      })
      .from(schema.deliverables)
      .where(
        and(
          eq(schema.deliverables.brandId, brand.id),
          isNull(schema.deliverables.archivedAt),
          gte(schema.deliverables.periodStart, isoDate(period.start)),
          lte(schema.deliverables.periodEnd, isoDate(period.end)),
        ),
      );

    const distribution = split
      ? distributeContractorPool({
          contractorFixedPoolCents: split.contractorFixedPoolCents,
          contractorVariablePoolCents: split.contractorVariablePoolCents,
          deliverables: deliverableRows
            .filter((d) => d.assigneeUserId !== null)
            .map((d) => ({
              id: d.id,
              assigneeUserId: d.assigneeUserId as string,
              fixedShareBps: d.fixedShareBps,
              status: d.status,
            })),
          contractors: contractorRows.map((c) => ({
            userId: c.userId,
            variableShareBps: 0, // equal-split default
          })),
        })
      : null;

    const mine = distribution?.shares.find((s) => s.userId === userId);

    const earning: BrandEarning = {
      brandId: brand.id,
      brandName: brand.name,
      fixedSharePoolCents: split?.contractorFixedPoolCents ?? 0,
      myFixedShareCents: mine?.fixedShareCents ?? 0,
      variablePoolCents: split?.contractorVariablePoolCents ?? 0,
      myVariableShareCents: mine?.variableShareCents ?? 0,
      totalCents: (mine?.fixedShareCents ?? 0) + (mine?.variableShareCents ?? 0),
      contributingDeliverableIds: mine?.contributingDeliverables ?? [],
      attributedSalesCents: sales.totalCents,
      plan: plan
        ? {
            fixedAmountCents: plan.fixedAmountCents,
            variablePercentBps: plan.variablePercentBps,
          }
        : null,
    };

    fixedTotal += earning.myFixedShareCents;
    variableTotal += earning.myVariableShareCents;
    result.push(earning);
  }

  return {
    byBrand: result,
    fixedTotalCents: fixedTotal,
    variableTotalCents: variableTotal,
    totalCents: fixedTotal + variableTotal,
  };
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
