import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');
  const { role } = await requireClientBrandAccess(actor, active.id);
  const isOwner =
    role === 'owner' || actor.globalRole === 'admin' || actor.globalRole === 'operator';

  const [brand] = await db
    .select({
      name: schema.brands.name,
      website: schema.brands.website,
      timezone: schema.brands.timezone,
      status: schema.brands.status,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Brand</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Settings</h1>
      </header>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <SettingsForm
          defaultName={brand?.name ?? ''}
          defaultWebsite={brand?.website ?? ''}
          defaultTimezone={brand?.timezone ?? 'UTC'}
          disabled={!isOwner}
        />
      </section>

      {isOwner && (
        <section className="border-asaulia-red/30 bg-asaulia-red/5 rounded-2xl border p-5">
          <div className="text-fg-3 mb-2 text-xs uppercase tracking-[0.12em]">Danger zone</div>
          <p className="text-fg-2 text-sm">
            Pausing suspends deliverables; cancelling ends service at the close of the current
            period. Contact support to proceed — self-serve controls arrive in a later phase.
          </p>
        </section>
      )}
    </main>
  );
}
