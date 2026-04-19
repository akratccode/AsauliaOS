'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoForward() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace('/dashboard'), 2_000);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
