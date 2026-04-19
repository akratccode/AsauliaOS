'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { finalizeOnboardingAction } from '../actions';

export function AutoForward({ sessionId }: { sessionId?: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await finalizeOnboardingAction(sessionId);
      } catch {
        // Webhook is the source of truth; ignore transient errors.
      }
      if (cancelled) return;
      const t = setTimeout(() => router.replace('/dashboard'), 1_500);
      return () => clearTimeout(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

  return null;
}
