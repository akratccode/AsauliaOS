import Link from 'next/link';
import { and, desc, eq, gte, lte, SQL } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { formatDate } from '@/lib/format';

type SearchParams = Promise<{
  actor?: string;
  entity_type?: string;
  action?: string;
  from?: string;
  to?: string;
}>;

export async function generateMetadata() {
  const t = await getTranslations('admin.audit');
  return { title: t('metadata') };
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const t = await getTranslations('admin.audit');

  const conditions: SQL[] = [];
  if (sp.actor) conditions.push(eq(schema.auditLog.actorUserId, sp.actor));
  if (sp.entity_type) conditions.push(eq(schema.auditLog.entityType, sp.entity_type));
  if (sp.action) conditions.push(eq(schema.auditLog.action, sp.action));
  if (sp.from) conditions.push(gte(schema.auditLog.createdAt, new Date(sp.from)));
  if (sp.to) conditions.push(lte(schema.auditLog.createdAt, new Date(sp.to)));

  const rows = await db
    .select({
      id: schema.auditLog.id,
      actorUserId: schema.auditLog.actorUserId,
      actorEmail: schema.users.email,
      brandId: schema.auditLog.brandId,
      action: schema.auditLog.action,
      entityType: schema.auditLog.entityType,
      entityId: schema.auditLog.entityId,
      before: schema.auditLog.before,
      after: schema.auditLog.after,
      createdAt: schema.auditLog.createdAt,
    })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(200);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('opsLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('auditTitle')}</h1>
        <p className="text-fg-3 mt-1 text-xs">{t('auditDesc')}</p>
      </header>

      <form method="get" className="grid gap-3 md:grid-cols-5 text-xs">
        <input
          name="actor"
          defaultValue={sp.actor ?? ''}
          placeholder={t('actorUserId')}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5 font-mono"
        />
        <input
          name="entity_type"
          defaultValue={sp.entity_type ?? ''}
          placeholder={t('entityType')}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
        />
        <input
          name="action"
          defaultValue={sp.action ?? ''}
          placeholder={t('action')}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
        />
        <input
          name="from"
          type="date"
          defaultValue={sp.from ?? ''}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
        />
        <div className="flex gap-2">
          <input
            name="to"
            type="date"
            defaultValue={sp.to ?? ''}
            className="border-fg-4/20 bg-bg-2 text-fg-1 flex-1 rounded-md border px-3 py-1.5"
          />
          <button
            type="submit"
            className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5"
          >
            { }
            Apply
          </button>
        </div>
      </form>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border divide-fg-4/10 divide-y">
        {rows.length === 0 ? (
          <p className="text-fg-3 p-5 text-sm">{t('noEvents')}</p>
        ) : (
          rows.map((r) => (
            <details key={r.id} className="group">
              <summary className="hover:bg-bg-2 flex cursor-pointer items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-fg-1 font-medium">{r.action}</div>
                  <div className="text-fg-3 text-xs">
                    {r.entityType ?? '—'}
                    {r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}
                    {r.brandId ? (
                      <>
                        {' · '}
                        <Link
                          href={`/admin/brands/${r.brandId}`}
                          className="hover:text-fg-1 hover:underline"
                        >
                          {t('brand')}
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="text-fg-3 text-xs text-right">
                  <div>{r.actorEmail ?? t('system')}</div>
                  <div>{formatDate(r.createdAt)}</div>
                </div>
              </summary>
              <div className="bg-bg-2 grid gap-3 p-5 md:grid-cols-2">
                <div>
                  <p className="text-fg-3 mb-1 text-xs uppercase tracking-[0.12em]">{t('before')}</p>
                  <pre className="text-fg-2 bg-bg-1 border-fg-4/10 overflow-x-auto rounded-md border p-3 text-xs">
                    {JSON.stringify(r.before ?? null, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-fg-3 mb-1 text-xs uppercase tracking-[0.12em]">{t('after')}</p>
                  <pre className="text-fg-2 bg-bg-1 border-fg-4/10 overflow-x-auto rounded-md border p-3 text-xs">
                    {JSON.stringify(r.after ?? null, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          ))
        )}
      </section>
    </main>
  );
}
