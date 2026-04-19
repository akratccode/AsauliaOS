export const metadata = { title: 'Privacy Policy — Asaulia' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8 text-sm">
      <header>
        <h1 className="text-fg-1 font-serif text-3xl italic">Privacy Policy</h1>
        <p className="text-fg-3 text-xs">Last updated: 2026-04-19</p>
      </header>
      <section className="text-fg-2 space-y-3">
        <h2 className="text-fg-1 mt-4 font-medium">Data we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account data: name, email, role.</li>
          <li>Brand data: integrations connected, orders you authorize us to read.</li>
          <li>Billing data: handled by Stripe; we store only customer + subscription IDs.</li>
          <li>Operational logs for debugging and security.</li>
        </ul>
        <h2 className="text-fg-1 mt-4 font-medium">How we use it</h2>
        <p>
          Only to operate the Service: attribute sales, invoice brands, pay
          contractors, and provide support. We do not sell your data.
        </p>
        <h2 className="text-fg-1 mt-4 font-medium">Subprocessors</h2>
        <p>
          Supabase (database + auth), Stripe (payments), Resend (email), Vercel
          (hosting), Sentry (errors), PostHog (product analytics).
        </p>
        <h2 className="text-fg-1 mt-4 font-medium">Your rights</h2>
        <p>
          You can request a copy or deletion of your data at privacy@asaulia.app.
          We respond within 30 days.
        </p>
      </section>
    </main>
  );
}
