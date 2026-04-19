import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { formatBps, formatCents, formatDate } from '@/lib/format';
import { PoolForm } from './pool-form';
import { AllocationForm } from './allocation-form';
import { EndAllocationForm } from './end-allocation-form';

type Params = Promise<{ brandId: string }>;

type PoolCurrency = 'USD' | 'COP';
type PoolScope = 'monthly' | 'quarterly' | 'per_project';

export default async function BrandCommissionPoolPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const t = await getTranslations('admin.commissionPool');

  const [poolRow] = await db
    .select()
    .from(schema.brandCommissionPools)
    .where(eq(schema.brandCommissionPools.brandId, brandId))
    .limit(1);

  const allocations = await db
    .select({
      id: schema.brandContractorAllocations.id,
      contractorUserId: schema.brandContractorAllocations.contractorUserId,
      currency: schema.brandContractorAllocations.currency,
      allocationBps: schema.brandContractorAllocations.allocationBps,
      startedAt: schema.brandContractorAllocations.startedAt,
      email: schema.users.email,
      fullName: schema.users.fullName,
    })
    .from(schema.brandContractorAllocations)
    .innerJoin(schema.users, eq(schema.users.id, schema.brandContractorAllocations.contractorUserId))
    .where(
      and(
        eq(schema.brandContractorAllocations.brandId, brandId),
        isNull(schema.brandContractorAllocations.endedAt),
      ),
    )
    .orderBy(desc(schema.brandContractorAllocations.startedAt));

  const eligibleContractors = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
    })
    .from(schema.brandContractors)
    .innerJoin(schema.users, eq(schema.users.id, schema.brandContractors.contractorUserId))
    .where(
      and(
        eq(schema.brandContractors.brandId, brandId),
        isNull(schema.brandContractors.endedAt),
      ),
    )
    .orderBy(asc(schema.users.fullName));

  const poolCurrency = (poolRow?.currency ?? 'USD') as PoolCurrency;
  const poolScope = (poolRow?.scope ?? 'monthly') as PoolScope;
  const sameCurrencyAllocations = allocations.filter((a) => a.currency === poolCurrency);
  const sumBps = sameCurrencyAllocations.reduce((acc, a) => acc + a.allocationBps, 0);
  const remainingBps = Math.max(0, 10000 - sumBps);

  const allocatedContractorIds = sameCurrencyAllocations.map((a) => a.contractorUserId);
  const addableContractors = eligibleContractors.filter(
    (c) => !allocatedContractorIds.includes(c.userId),
  );

  const scopeLabel =
    poolScope === 'monthly'
      ? t('scopeMonthly')
      : poolScope === 'quarterly'
        ? t('scopeQuarterly')
        : t('scopePerProject');

  const formatBpsPercent = (bps: number): string =>
    `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}`;

  return (
    <div className="space-y-4">
      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-1 font-serif text-lg italic">{t('poolTitle')}</h2>
        <p className="text-fg-3 mb-3 text-xs">{t('poolDesc')}</p>
        <PoolForm
          brandId={brandId}
          initial={{
            currency: poolCurrency,
            scope: poolScope,
            poolBps: poolRow?.poolBps ?? null,
            poolAmountCents: poolRow?.poolAmountCents ?? null,
            note: poolRow?.note ?? '',
          }}
        />

        <div className="border-fg-4/10 mt-4 border-t pt-3">
          <h3 className="text-fg-2 mb-1 text-xs uppercase tracking-[0.12em]">
            {t('currentPoolTitle')}
          </h3>
          {poolRow ? (
            <p className="text-fg-2 text-sm">
              {poolRow.poolBps !== null && poolRow.poolAmountCents !== null
                ? t('poolSummary', {
                    bps: formatBpsPercent(poolRow.poolBps),
                    cap: formatCents(poolRow.poolAmountCents, poolCurrency),
                    scope: scopeLabel,
                  })
                : poolRow.poolBps !== null
                  ? t('poolSummaryBpsOnly', {
                      bps: formatBpsPercent(poolRow.poolBps),
                      scope: scopeLabel,
                    })
                  : t('poolSummaryCapOnly', {
                      cap: formatCents(poolRow.poolAmountCents ?? 0, poolCurrency),
                      scope: scopeLabel,
                    })}
            </p>
          ) : (
            <p className="text-fg-3 text-sm">{t('noPool')}</p>
          )}
        </div>
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-1 font-serif text-lg italic">{t('allocationsTitle')}</h2>
        <p className="text-fg-3 mb-3 text-xs">{t('allocationsDesc')}</p>

        <p className="text-fg-2 mb-3 text-xs">
          {t('currentSum', {
            percent: formatBpsPercent(sumBps),
            remaining: formatBpsPercent(remainingBps),
          })}
        </p>

        {sameCurrencyAllocations.length === 0 ? (
          <p className="text-fg-3 text-sm">{t('noAllocations')}</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y">
            {sameCurrencyAllocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="text-fg-1 font-medium">{a.fullName ?? a.email}</div>
                  <div className="text-fg-3 text-xs">
                    {formatBps(a.allocationBps)} · {a.currency} · {t('startedColumn')}{' '}
                    {formatDate(a.startedAt)}
                  </div>
                </div>
                <EndAllocationForm allocationId={a.id} brandId={brandId} />
              </li>
            ))}
          </ul>
        )}

        <div className="border-fg-4/10 mt-4 border-t pt-3">
          <h3 className="text-fg-2 mb-1 text-xs uppercase tracking-[0.12em]">
            {t('addAllocation')}
          </h3>
          <p className="text-fg-3 mb-2 text-xs">{t('addAllocationDesc')}</p>
          {!poolRow ? (
            <p className="text-fg-3 text-sm">{t('noPool')}</p>
          ) : addableContractors.length === 0 ? (
            <p className="text-fg-3 text-sm">{t('noEligibleContractors')}</p>
          ) : (
            <AllocationForm
              brandId={brandId}
              currency={poolCurrency}
              remainingBps={remainingBps}
              contractors={addableContractors.map((c) => ({
                userId: c.userId,
                label: c.fullName ?? c.email,
              }))}
            />
          )}
        </div>
      </section>
    </div>
  );
}
