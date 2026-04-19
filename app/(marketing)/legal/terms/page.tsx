export const metadata = { title: 'Terms of Service — Asaulia' };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8 text-sm">
      <header>
        <h1 className="text-fg-1 font-serif text-3xl italic">Terms of Service</h1>
        <p className="text-fg-3 text-xs">Last updated: 2026-04-19</p>
      </header>
      <section className="text-fg-2 space-y-3">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of Asaulia (&quot;Service&quot;), operated by Asaulia Inc.
        </p>
        <h2 className="text-fg-1 mt-4 font-medium">1. Accounts</h2>
        <p>
          You are responsible for safeguarding your account credentials and all
          activity under your account.
        </p>
        <h2 className="text-fg-1 mt-4 font-medium">2. Fees &amp; billing</h2>
        <p>
          Brands pay a fixed monthly fee plus a variable percentage of
          attributed sales per the plan selected at onboarding. Plan changes
          take effect at the next billing cycle. Cancellation stops future
          billing; past cycles are not refundable.
        </p>
        <h2 className="text-fg-1 mt-4 font-medium">3. Contractor payouts</h2>
        <p>
          Contractor earnings are transferred via Stripe Connect after a
          reconciliation buffer. A $50 minimum applies; amounts below are
          carried to the next cycle.
        </p>
        <h2 className="text-fg-1 mt-4 font-medium">4. Acceptable use</h2>
        <p>
          No illegal activity, no harassment, no circumventing security
          controls. Violations may result in suspension.
        </p>
        <h2 className="text-fg-1 mt-4 font-medium">5. Disclaimers</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranties. To the
          fullest extent permitted by law, Asaulia disclaims all implied
          warranties.
        </p>
        <h2 className="text-fg-1 mt-4 font-medium">6. Contact</h2>
        <p>Questions: legal@asaulia.app</p>
      </section>
    </main>
  );
}
