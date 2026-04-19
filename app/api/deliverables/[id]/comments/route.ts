import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/rbac';
import { Forbidden, Unauthorized } from '@/lib/auth/errors';
import { addComment, listComments } from '@/lib/deliverables/service';

const BodySchema = z.object({
  content: z.string().min(1).max(10_000),
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireAuth();
    const items = await listComments(actor, id);
    return NextResponse.json({ items });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireAuth();
    const body = BodySchema.parse(await req.json());
    const row = await addComment(actor, id, body.content);
    return NextResponse.json({ comment: row }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
