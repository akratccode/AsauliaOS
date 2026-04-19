import Link from 'next/link';
import { asc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export const revalidate = 300;

export default async function AdminMatrixPage() {
  const [contractors, brands, assignments] = await Promise.all([
    db
      .select({
        userId: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
      })
      .from(schema.users)
      .innerJoin(schema.contractorProfiles, eq(schema.contractorProfiles.userId, schema.users.id))
      .where(eq(schema.contractorProfiles.status, 'active'))
      .orderBy(asc(schema.users.email)),
    db
      .select({ id: schema.brands.id, name: schema.brands.name })
      .from(schema.brands)
      .where(eq(schema.brands.status, 'active'))
      .orderBy(asc(schema.brands.name)),
    db
      .select({
        contractorUserId: schema.brandContractors.contractorUserId,
        brandId: schema.brandContractors.brandId,
        role: schema.brandContractors.role,
      })
      .from(schema.brandContractors)
      .where(isNull(schema.brandContractors.endedAt)),
  ]);

  const key = (u: string, b: string) => `${u}:${b}`;
  const map = new Map<string, string>();
  for (const a of assignments) map.set(key(a.contractorUserId, a.brandId), a.role);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Ops</p>
          <h1 className="text-fg-1 font-serif text-3xl italic">Assignment matrix</h1>
        </div>
        <p className="text-fg-3 text-xs">
          {contractors.length} × {brands.length} · {assignments.length} active
        </p>
      </header>

      {contractors.length === 0 || brands.length === 0 ? (
        <p className="text-fg-3 text-sm">
          Matrix appears once you have at least one active brand and contractor.
        </p>
      ) : (
        <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
          <table className="min-w-full text-xs">
            <thead className="bg-bg-2">
              <tr>
                <th className="text-fg-3 sticky left-0 px-3 py-2 text-left">Contractor</th>
                {brands.map((b) => (
                  <th
                    key={b.id}
                    className="text-fg-3 max-w-[7rem] truncate whitespace-nowrap px-3 py-2 text-left uppercase tracking-[0.1em]"
                    title={b.name}
                  >
                    <Link
                      href={`/admin/brands/${b.id}`}
                      className="hover:text-fg-1 hover:underline"
                    >
                      {b.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contractors.map((c) => (
                <tr key={c.userId} className="border-fg-4/10 border-t">
                  <td className="text-fg-1 sticky left-0 bg-bg-1 px-3 py-2">
                    <Link
                      href={`/admin/contractors/${c.userId}`}
                      className="hover:underline"
                    >
                      {c.fullName ?? c.email}
                    </Link>
                  </td>
                  {brands.map((b) => {
                    const role = map.get(key(c.userId, b.id));
                    return (
                      <td
                        key={b.id}
                        className={`px-3 py-2 ${
                          role ? 'bg-asaulia-blue/10 text-fg-1' : 'text-fg-4/30'
                        }`}
                      >
                        {role ?? '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
