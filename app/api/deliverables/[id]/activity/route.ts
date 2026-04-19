import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/rbac';
import { Forbidden, Unauthorized } from '@/lib/auth/errors';
import { listActivity } from '@/lib/deliverables/service';

function handleError(err: unknown): NextResponse {
  if (err instanceof Unauthorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (err instanceof Forbidden) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return NextResponse.json({ error: 'internal_error' }, { status: 500 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireAuth();
    const items = await listActivity(actor, id);
    return NextResponse.json({ items });
  } catch (err) {
    return handleError(err);
  }
}
