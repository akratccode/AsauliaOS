import Image from 'next/image';

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 100%, rgba(58,91,255,0.55) 0%, rgba(58,91,255,0.22) 35%, rgba(58,91,255,0) 70%)',
        }}
      />
      <Image
        src="/brand/asaulia-logo.png"
        alt="Asaulia"
        width={220}
        height={64}
        priority
        className="mb-10 h-auto w-[200px] opacity-90"
      />
      <h1 className="text-fg-1 font-sans text-4xl font-semibold tracking-tight md:text-5xl">
        Asaulia
      </h1>
      <p className="text-fg-2 font-serif mt-6 max-w-xl text-xl italic md:text-2xl">
        Agency-as-a-service. A fixed retainer plus a share of what we help you sell.
      </p>
    </main>
  );
}
