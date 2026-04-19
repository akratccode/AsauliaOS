import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/tasks', '/clients', '/earnings', '/admin'];
const AUTH_ONLY_PREFIXES = ['/login', '/signup', '/reset-password', '/verify-email'];

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = request.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthOnly = AUTH_ONLY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && isProtected) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', path);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthOnly && !path.startsWith('/verify-email')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}
