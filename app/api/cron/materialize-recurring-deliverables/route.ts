import { NextResponse } from 'next/server';
import { assertCronSecret, CronAuthError } from '@/lib/billing/cron';
import { materializeDueRecurrences } from '@/lib/deliverables/recurrences';

export async function POST(req: Request) {
  try {
    assertCronSecret(req);
  } catch (err) {
    if (err instanceof CronAuthError) {
      return NextResponse.json({ error: err.code }, { status: 401 });
    }
    throw err;
  }

  const result = await materializeDueRecurrences({ now: new Date() });
  return NextResponse.json(result);
}

export const GET = POST;
