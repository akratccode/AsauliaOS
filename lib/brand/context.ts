import 'server-only';
import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { AuthContext } from '@/lib/auth/rbac';
import { isStaff } from '@/lib/deliverables/service';

export const ACTIVE_BRAND_COOKIE = 'active_brand_id';

export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  role: 'owner' | 'member' | null;
  status: string;
};

export async function listUserBrands(actor: AuthContext): Promise<BrandSummary[]> {
  if (isStaff(actor)) {
    const rows = await db
      .select({
        id: schema.brands.id,
        name: schema.brands.name,
        slug: schema.brands.slug,
        timezone: schema.brands.timezone,
        status: schema.brands.status,
      })
      .from(schema.brands)
      .orderBy(schema.brands.createdAt);
    return rows.map((r) => ({ ...r, role: null }));
  }
  const rows = await db
    .select({
      id: schema.brands.id,
      name: schema.brands.name,
      slug: schema.brands.slug,
      timezone: schema.brands.timezone,
      status: schema.brands.status,
      role: schema.brandMembers.role,
    })
    .from(schema.brandMembers)
    .innerJoin(schema.brands, eq(schema.brandMembers.brandId, schema.brands.id))
    .where(eq(schema.brandMembers.userId, actor.userId))
    .orderBy(schema.brands.name);
  return rows;
}

export async function resolveActiveBrand(
  actor: AuthContext,
  requestedBrandId?: string,
): Promise<{ active: BrandSummary | null; available: BrandSummary[] }> {
  const available = await listUserBrands(actor);
  if (available.length === 0) return { active: null, available };

  if (requestedBrandId) {
    const match = available.find((b) => b.id === requestedBrandId);
    if (match) return { active: match, available };
  }

  const store = await cookies();
  const cookieBrandId = store.get(ACTIVE_BRAND_COOKIE)?.value;
  if (cookieBrandId) {
    const match = available.find((b) => b.id === cookieBrandId);
    if (match) return { active: match, available };
  }

  const ownerFirst =
    available.find((b) => b.role === 'owner') ?? available[0] ?? null;
  return { active: ownerFirst, available };
}

export async function requireClientBrandAccess(
  actor: AuthContext,
  brandId: string,
): Promise<{ role: 'owner' | 'member' | null }> {
  if (isStaff(actor)) return { role: null };
  const row = await db
    .select({ role: schema.brandMembers.role })
    .from(schema.brandMembers)
    .where(
      and(
        eq(schema.brandMembers.userId, actor.userId),
        eq(schema.brandMembers.brandId, brandId),
      ),
    )
    .limit(1);
  if (!row[0]) {
    throw new Error('forbidden: not a member of this brand');
  }
  return { role: row[0].role };
}
