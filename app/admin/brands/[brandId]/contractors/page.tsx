import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { formatDate } from '@/lib/format';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandContractorsPage({ params }: { params: Params }) {
  const { brandId } = await params;

  const rows = await db
    .select({
      id: schema.brandContractors.id,
      userId: schema.brandContractors.contractorUserId,
      email: schema.users.email,
      fullName: schema.users.fullName,
      role: schema.brandContractors.role,
      startedAt: schema.brandContractors.startedAt,
      endedAt: schema.brandContractors.endedAt,
    })
    .from(schema.brandContractors)
    .innerJoin(schema.users, eq(schema.users.id, schema.brandContractors.contractorUserId))
    .where(and(eq(schema.brandContractors.brandId, brandId), isNull(schema.brandContractors.endedAt)))
    .orderBy(desc(schema.brandContractors.startedAt));

  return (
    <div className="space-y-4">
      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">Assigned contractors</h2>
        {rows.length === 0 ? (
          <p className="text-fg-3 text-sm">No active assignments.</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="text-fg-1 font-medium">{r.fullName ?? r.email}</div>
                  <div className="text-fg-3 text-xs">
                    {r.role} · since {formatDate(r.startedAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-2 font-serif text-lg italic">Variable-pool weights</h2>
        <p className="text-fg-3 text-xs">
          Weights default to an equal split among active contractors. Per-period weight overrides
          (`brand_contractor_weights`) land with the Phase 11 cycle-close job; normalization helper
          already exists in `lib/admin/weights.ts`.
        </p>
      </section>
    </div>
  );
}
