import Link from 'next/link';
import { and, eq, gte, isNull, or } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveBillingWindow } from '@/lib/brand/billing-period';
import { projectEarningsForPeriod } from '@/lib/contractor/earnings';
import { formatCents } from '@/lib/format';

export default async function ContractorClientsPage() {
  const actor = await requireAuth();
  const window = resolveBillingWindow(null);

  const rows = await db
    .select({
      brandId: schema.brands.id,
      brandName: schema.brands.name,
      role: schema.brandContractors.role,
      startedAt: schema.brandContractors.startedAt,
    })
    .from(schema.brandContractors)
    .innerJoin(schema.brands, eq(schema.brandContractors.brandId, schema.brands.id))
    .where(
      and(
        eq(schema.brandContractors.contractorUserId, actor.userId),
        or(
          isNull(schema.brandContractors.endedAt),
          gte(schema.brandContractors.endedAt, window.start),
        ),
      ),
    )
    .orderBy(schema.brands.name);

  const projection = await projectEarningsForPeriod(actor.userId, {
    start: window.start,
    end: window.end,
  });
  const earningsByBrand = new Map(projection.byBrand.map((e) => [e.brandId, e.totalCents]));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Assignments</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Clients</h1>
      </header>

      {rows.length === 0 ? (
        <p className="text-fg-3 text-sm">No active assignments yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <Link
              key={r.brandId}
              href={`/clients/${r.brandId}`}
              className="border-fg-4/15 bg-bg-1 hover:border-asaulia-blue/40 block rounded-2xl border p-5"
            >
              <div className="text-fg-1 font-serif text-lg italic">{r.brandName}</div>
              <div className="text-fg-3 mt-1 text-xs">Role: {r.role}</div>
              <div className="text-fg-2 mt-3 text-sm">
                Projected this period · {formatCents(earningsByBrand.get(r.brandId) ?? 0)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
