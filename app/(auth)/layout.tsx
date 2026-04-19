import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-bg-0 text-fg-1 relative min-h-dvh overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-[480px] w-[720px] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 50%, color-mix(in oklch, var(--color-asaulia-blue) 80%, transparent), transparent)',
        }}
        aria-hidden
      />
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        {children}
      </main>
    </div>
  );
}
