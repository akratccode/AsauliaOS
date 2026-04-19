import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/rbac';
import { Forbidden, Unauthorized } from '@/lib/auth/errors';
import {
  createDeliverable,
  listDeliverablesForBrand,
} from '@/lib/deliverables/service';
import { monthStringToPeriod } from '@/lib/billing/period';

const CreateBodySchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  type: z.enum([
    'content_post',
    'ad_creative',
    'landing_page',
    'seo_article',
    'email_sequence',
    'strategy_doc',
    'custom',
  ]),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assigneeUserId: z.string().uuid().optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  fixedShareBps: z.number().int().min(0).max(10_000).optional(),
});

function handleError(err: unknown): NextResponse {
  if (err instanceof Unauthorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (err instanceof Forbidden) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: 'invalid_input', issues: err.issues }, { status: 400 });
  }
  return NextResponse.json({ error: 'internal_error' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const actor = await requireAuth();
    const url = new URL(req.url);
    const brandId = url.searchParams.get('brandId');
    if (!brandId) {
      return NextResponse.json({ error: 'missing_brandId' }, { status: 400 });
    }
    const period = url.searchParams.get('period');
    const periodRange = period ? monthStringToPeriod(period) : undefined;
    const items = await listDeliverablesForBrand(actor, brandId, periodRange);
    return NextResponse.json({ items });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    const body = CreateBodySchema.parse(await req.json());
    const row = await createDeliverable(actor, body);
    return NextResponse.json({ deliverable: row }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
