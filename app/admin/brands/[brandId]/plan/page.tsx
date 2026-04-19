import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { PlanOverrideForm } from './PlanOverrideForm';
import { formatCents, formatBps, formatDate } from '@/lib/format';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandPlanPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const plans = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.brandId, brandId))
    .orderBy(desc(schema.plans.effectiveFrom));

  return (
    <div className="space-y-5">
      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">Plan history</h2>
        {plans.length === 0 ? (
          <p className="text-fg-3 text-sm">No plans on file.</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y text-sm">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-fg-1 font-medium">
                    {formatCents(p.fixedAmountCents)} + {formatBps(p.variablePercentBps)}
                  </div>
                  <div className="text-fg-3 text-xs">
                    from {formatDate(p.effectiveFrom)}{' '}
                    {p.effectiveTo ? `until ${formatDate(p.effectiveTo)}` : '· current'}
                  </div>
                </div>
                {!p.effectiveTo && (
                  <span className="bg-asaulia-blue/15 text-fg-1 rounded-full px-2 py-0.5 text-xs">
                    active
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 space-y-3 rounded-2xl border p-5">
        <h2 className="text-fg-1 font-serif text-lg italic">Override</h2>
        <p className="text-fg-3 text-xs">
          Bypasses the client-side cooldown. Every override is audit-logged with the reason.
        </p>
        <PlanOverrideForm brandId={brandId} />
      </section>
    </div>
  );
}
