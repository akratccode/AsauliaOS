import { and, asc, desc, eq, isNull, notInArray } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { AssignContractorForm } from './assign-form';
import { EndAssignmentForm } from './end-assignment-form';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandContractorsPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const t = await getTranslations('admin.brandContractors');

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
    .where(
      and(
        eq(schema.brandContractors.brandId, brandId),
        isNull(schema.brandContractors.endedAt),
      ),
    )
    .orderBy(desc(schema.brandContractors.startedAt));

  const activeUserIds = rows.map((r) => r.userId);
  const availableContractors = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
    })
    .from(schema.users)
    .innerJoin(schema.contractorProfiles, eq(schema.contractorProfiles.userId, schema.users.id))
    .where(
      and(
        eq(schema.users.globalRole, 'contractor'),
        eq(schema.contractorProfiles.status, 'active'),
        activeUserIds.length > 0 ? notInArray(schema.users.id, activeUserIds) : undefined,
      ),
    )
    .orderBy(asc(schema.users.fullName));

  return (
    <div className="space-y-4">
      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">{t('assignedTitle')}</h2>
        {rows.length === 0 ? (
          <p className="text-fg-3 text-sm">{t('noActiveAssignments')}</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="text-fg-1 font-medium">{r.fullName ?? r.email}</div>
                  <div className="text-fg-3 text-xs">
                    {t('roleSince', { role: r.role, date: formatDate(r.startedAt) })}
                  </div>
                </div>
                <EndAssignmentForm assignmentId={r.id} brandId={brandId} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">{t('assignTitle')}</h2>
        {availableContractors.length === 0 ? (
          <p className="text-fg-3 text-sm">{t('noContractorsAvailable')}</p>
        ) : (
          <AssignContractorForm
            brandId={brandId}
            contractors={availableContractors.map((c) => ({
              userId: c.userId,
              label: c.fullName ?? c.email,
            }))}
          />
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-2 font-serif text-lg italic">{t('weightsTitle')}</h2>
        <p className="text-fg-3 text-xs">{t('weightsDesc')}</p>
      </section>
    </div>
  );
}
