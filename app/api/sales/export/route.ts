import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/rbac';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { listSales, salesToCsv, type SalesFilter } from '@/lib/sales/service';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { resolveBillingWindow } from '@/lib/brand/billing-period';

export async function GET(req: Request) {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return NextResponse.json({ error: 'no_brand' }, { status: 404 });
  await requireClientBrandAccess(actor, active.id);

  const url = new URL(req.url);
  const range = url.searchParams.get('range') ?? 'period';
  const attribution = url.searchParams.get('attribution');

  const [brand] = await db
    .select({ billingCycleDay: schema.brands.billingCycleDay })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);

  const filter: SalesFilter = {
    brandId: active.id,
    integrationId: url.searchParams.get('integration') ?? null,
    attribution:
      attribution === 'attributed' || attribution === 'unattributed' ? attribution : 'all',
    page: 1,
    pageSize: 5_000,
  };

  const now = new Date();
  if (range === 'period') {
    const window = resolveBillingWindow(brand?.billingCycleDay ?? null);
    filter.occurredFrom = window.start;
    filter.occurredTo = window.end;
  } else if (range === '30d') {
    filter.occurredFrom = new Date(now.getTime() - 30 * 86_400_000);
  } else if (range === '90d') {
    filter.occurredFrom = new Date(now.getTime() - 90 * 86_400_000);
  }

  const result = await listSales(filter);
  const csv = salesToCsv(result.rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="asaulia-sales-${Date.now()}.csv"`,
    },
  });
}
