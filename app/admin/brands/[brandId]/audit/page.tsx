import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { formatRelative } from '@/lib/format';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandAuditPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const rows = await db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      entityType: schema.auditLog.entityType,
      entityId: schema.auditLog.entityId,
      actorUserId: schema.auditLog.actorUserId,
      before: schema.auditLog.before,
      after: schema.auditLog.after,
      createdAt: schema.auditLog.createdAt,
    })
    .from(schema.auditLog)
    .where(eq(schema.auditLog.brandId, brandId))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(100);

  return (
    <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
      <h2 className="text-fg-1 mb-3 font-serif text-lg italic">Audit log</h2>
      {rows.length === 0 ? (
        <p className="text-fg-3 text-sm">No audit entries for this brand.</p>
      ) : (
        <ul className="divide-fg-4/10 divide-y">
          {rows.map((r) => (
            <li key={r.id} className="py-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-fg-1 font-medium">{r.action}</span>
                <span className="text-fg-3">{formatRelative(r.createdAt)}</span>
              </div>
              <div className="text-fg-3 mt-1">
                {r.entityType ?? ''}{' '}
                {r.entityId ? <span className="font-mono">{r.entityId.slice(0, 8)}</span> : null}
                {r.actorUserId ? (
                  <>
                    {' · by '}
                    <span className="font-mono">{r.actorUserId.slice(0, 8)}</span>
                  </>
                ) : null}
              </div>
              {(r.before !== null || r.after !== null) ? (
                <details className="text-fg-3 mt-2">
                  <summary className="cursor-pointer">diff</summary>
                  <pre className="bg-bg-2 text-fg-2 mt-1 overflow-x-auto rounded p-2 text-[11px]">
                    {JSON.stringify({ before: r.before, after: r.after }, null, 2)}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
