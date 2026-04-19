import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { currentCycleFor } from '@/lib/billing/period';
import { formatDate } from '@/lib/format';
import { CancelForm } from './form';

export default async function CancelPage() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');
  await requireClientBrandAccess(actor, active.id);

  const [brand] = await db
    .select({
      id: schema.brands.id,
      status: schema.brands.status,
      cancelledAt: schema.brands.cancelledAt,
      billingCycleDay: schema.brands.billingCycleDay,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);
  if (!brand) redirect('/billing');
  if (brand.cancelledAt || brand.status === 'cancelled') redirect('/billing');

  const cycle = currentCycleFor(
    { billingCycleDay: brand.billingCycleDay ?? 1 },
    new Date(),
  );

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Billing</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Cancel subscription</h1>
      </header>

      <section className="border-fg-4/15 bg-bg-1 space-y-3 rounded-2xl border p-5 text-sm">
        <p className="text-fg-2">
          Your plan stays active through <strong>{formatDate(cycle.end)}</strong>.
          The final invoice will include any attributed sales from days your
          plan was active in this cycle.
        </p>
        <ul className="text-fg-3 list-disc space-y-1 pl-5 text-xs">
          <li>Deliverables already closed in this cycle are kept.</li>
          <li>Contractor payouts for the final cycle process normally.</li>
          <li>You can reverse this before the cycle ends.</li>
        </ul>
      </section>

      <CancelForm />

      <Link href="/billing" className="text-fg-3 text-xs hover:underline">
        Go back
      </Link>
    </main>
  );
}
