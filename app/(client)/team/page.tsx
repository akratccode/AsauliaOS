import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import {
  resolveActiveBrand,
  requireClientBrandAccess,
} from '@/lib/brand/context';
import { formatDate } from '@/lib/format';
import { InviteForm, RevokeInviteButton } from './TeamForms';

export default async function TeamPage() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');
  const { role } = await requireClientBrandAccess(actor, active.id);
  const isOwner = role === 'owner' || actor.globalRole === 'admin' || actor.globalRole === 'operator';

  const members = await db
    .select({
      id: schema.brandMembers.id,
      role: schema.brandMembers.role,
      acceptedAt: schema.brandMembers.acceptedAt,
      email: schema.users.email,
      fullName: schema.users.fullName,
    })
    .from(schema.brandMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.brandMembers.userId))
    .where(eq(schema.brandMembers.brandId, active.id));

  const pendingInvites = await db
    .select()
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.brandId, active.id),
        isNull(schema.invitations.acceptedAt),
      ),
    );

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Members</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Team</h1>
      </header>

      {isOwner && (
        <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <div className="text-fg-3 mb-3 text-xs uppercase tracking-[0.12em]">
            Invite a member
          </div>
          <InviteForm disabled={false} />
        </section>
      )}

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="text-fg-3 mb-3 text-xs uppercase tracking-[0.12em]">Current members</div>
        {members.length === 0 ? (
          <p className="text-fg-3 text-sm">No members yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-fg-3 text-xs uppercase tracking-[0.12em]">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-fg-4/10 divide-y">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 text-fg-1">{m.fullName ?? '—'}</td>
                  <td className="py-2 text-fg-2">{m.email}</td>
                  <td className="py-2 text-fg-2 capitalize">{m.role}</td>
                  <td className="py-2 text-fg-3 text-xs">
                    {m.acceptedAt ? formatDate(m.acceptedAt) : 'Pending'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {pendingInvites.length > 0 && (
        <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <div className="text-fg-3 mb-3 text-xs uppercase tracking-[0.12em]">
            Pending invites
          </div>
          <ul className="divide-fg-4/10 divide-y text-sm">
            {pendingInvites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-2">
                <span className="text-fg-2">{inv.email}</span>
                <span className="text-fg-3 text-xs">
                  expires {formatDate(inv.expiresAt)}
                </span>
                {isOwner && <RevokeInviteButton invitationId={inv.id} disabled={false} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
