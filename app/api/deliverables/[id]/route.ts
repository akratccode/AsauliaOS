import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/rbac';
import { Forbidden, Unauthorized } from '@/lib/auth/errors';
import {
  InvalidTransitionError,
  archiveDeliverable,
  assignDeliverable,
  updateDeliverableContent,
  updateDeliverableStatus,
} from '@/lib/deliverables/service';

const PatchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).optional().nullable(),
    type: z
      .enum([
        'content_post',
        'ad_creative',
        'landing_page',
        'seo_article',
        'email_sequence',
        'strategy_doc',
        'custom',
      ])
      .optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    fixedShareBps: z.number().int().min(0).max(10_000).optional(),
    status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'rejected']).optional(),
    assigneeUserId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty patch' });

function handleError(err: unknown): NextResponse {
  if (err instanceof Unauthorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (err instanceof Forbidden) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (err instanceof InvalidTransitionError) {
    return NextResponse.json({ error: 'invalid_transition' }, { status: 400 });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: 'invalid_input', issues: err.issues }, { status: 400 });
  }
  return NextResponse.json({ error: 'internal_error' }, { status: 500 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireAuth();
    const body = PatchSchema.parse(await req.json());

    let row;
    if (body.status) {
      row = await updateDeliverableStatus(actor, id, body.status);
    }
    if (body.assigneeUserId !== undefined) {
      row = await assignDeliverable(actor, id, body.assigneeUserId);
    }
    const contentPatch = {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate }),
      ...(body.fixedShareBps !== undefined && { fixedShareBps: body.fixedShareBps }),
    };
    if (Object.keys(contentPatch).length > 0) {
      row = await updateDeliverableContent(actor, id, contentPatch);
    }
    return NextResponse.json({ deliverable: row });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireAuth();
    const row = await archiveDeliverable(actor, id);
    return NextResponse.json({ deliverable: row });
  } catch (err) {
    return handleError(err);
  }
}
