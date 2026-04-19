import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { env } from '@/lib/env';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', env.NEXT_PUBLIC_APP_URL));
}

export async function GET() {
  return POST();
}
