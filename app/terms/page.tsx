import Link from "next/link";

export const metadata = { title: "Terms of Service — The Care Royal" };

export default function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="font-serif text-2xl font-semibold text-brand">The Care Royal</Link>
      <h1 className="mt-8 font-serif text-4xl text-ink">Terms of Service</h1>
      <p className="mt-2 text-sm text-ink-light">Last updated {new Date().getFullYear()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-mid">
        <p>
          These Terms govern your use of The Care Royal platform ("Service"). By creating an account or
          using the Service, you ("you," or your "Agency") agree to these Terms. If you use the Service on
          behalf of a business, you represent that you are authorized to bind that business.
        </p>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">What we are — and are not</h2>
          <p>The Care Royal is <b>software</b> that helps home-care agencies run their operations. We are
          not a home-care agency, employer, staffing agency, or payer. We do not provide care, employ
          caregivers, or supervise the services your Agency delivers. Your Agency is solely responsible for
          its caregivers, clients, care, licensing, insurance, and compliance with all applicable laws.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Subscriptions, trials, and billing</h2>
          <p>Paid plans are billed monthly in advance through our payment processor (Stripe). Free trials
          convert to a paid subscription at the end of the trial unless you cancel before it ends. Fees are
          non-refundable except where required by law. You can cancel anytime; cancellation takes effect at
          the end of the current billing period. We may change plan pricing with reasonable notice.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Payments to your Agency</h2>
          <p>If you accept client payments through the Service, you connect your own Stripe account and are
          the merchant of record for those transactions. The Care Royal never holds, controls, or disburses
          your funds. Card processing and any platform fees are disclosed at the time you connect.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Payroll, accounting, and third-party connections</h2>
          <p>You may connect your own accounts (such as Gusto for payroll or QuickBooks for accounting).
          Those services are provided by third parties under their own terms; we are not responsible for
          them. In-app pay documents and tax calculations are provided as tools to assist you and do not
          constitute tax, legal, or accounting advice. You are responsible for the accuracy of your payroll,
          filings, and records.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Your data</h2>
          <p>Your Agency's data — including your clients, caregivers, and records — remains yours. You grant
          us the limited rights needed to host and operate the Service for you. You are responsible for
          having the right to upload the information you enter and for handling protected health and personal
          information in line with your legal obligations.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Acceptable use</h2>
          <p>Do not misuse the Service: no unlawful, infringing, or harmful activity; no attempts to breach
          security or access other agencies' data; no reselling the Service without our written consent.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Disclaimers and limitation of liability</h2>
          <p>The Service is provided "as is" without warranties of any kind. To the fullest extent permitted
          by law, The Care Royal is not liable for indirect, incidental, or consequential damages, and our
          total liability is limited to the amount you paid us in the twelve months before the claim.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Termination</h2>
          <p>You may stop using the Service and cancel at any time. We may suspend or terminate access for
          violation of these Terms or non-payment. On termination you may export your data for a reasonable
          period, after which it may be deleted.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Governing law and disputes</h2>
          <p>These Terms are governed by the laws of the State of California, without regard to conflict-of-law
          rules. Any dispute will be resolved by binding arbitration on an individual basis, except that
          either party may seek injunctive relief in court for infringement or misuse. You and The Care Royal
          waive any right to a jury trial or class action.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Contact</h2>
          <p>Questions about these Terms? Contact us at <a href="mailto:info@thecareroyal.com" className="text-brand">info@thecareroyal.com</a>.</p>
        </section>

        <p className="text-xs text-ink-light">These Terms are a general template and not legal advice. Have counsel review
        them before relying on them for your business.</p>
      </div>

      <div className="mt-10 border-t border-rule pt-6 text-sm">
        <Link href="/privacy/" className="text-brand">Privacy Notice</Link>
      </div>
    </main>
  );
}
