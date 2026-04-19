import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/rbac';
import { Forbidden, Unauthorized } from '@/lib/auth/errors';
import { addAttachment, listAttachments } from '@/lib/deliverables/service';
import { MAX_ATTACHMENT_BYTES } from '@/lib/deliverables/attachments';

const BodySchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(200).nullable(),
  sizeBytes: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
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
  if (err instanceof Error) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  return NextResponse.json({ error: 'internal_error' }, { status: 500 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireAuth();
    const items = await listAttachments(actor, id);
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
    const row = await addAttachment(actor, id, { ...body, uuid: randomUUID() });
    return NextResponse.json({ attachment: row }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
