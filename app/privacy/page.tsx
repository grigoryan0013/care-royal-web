import Link from "next/link";

export const metadata = { title: "Privacy Notice — The Care Royal" };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="font-serif text-2xl font-semibold text-brand">The Care Royal</Link>
      <h1 className="mt-8 font-serif text-4xl text-ink">Privacy Notice</h1>
      <p className="mt-2 text-sm text-ink-light">Last updated {new Date().getFullYear()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-mid">
        <p>
          This Privacy Notice explains how The Care Royal ("we," "us") collects and uses information when you
          join our waitlist, submit a questionnaire, or use our platform. By providing your information,
          you agree to the practices described here.
        </p>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Information we collect</h2>
          <p>Information you give us — such as your name, email, phone number, location, the care details
          you share, and, for agencies, business details. We also collect basic technical information
          automatically, such as device and usage data.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">How we use it</h2>
          <p>To contact you about your request, to operate and improve the platform, to connect families
          with caregivers or agencies, to send updates you have agreed to receive, and to comply with
          law. We use the details you provide to prepare for and provide our services.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Communications consent</h2>
          <p>If you opt in, we may contact you by email, phone, or text message about The Care Royal. Message
          and data rates may apply. You can opt out of marketing messages at any time by replying STOP to
          a text, using the unsubscribe link in an email, or contacting us.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Sharing</h2>
          <p>We do not sell your personal information. We may share information with service providers who
          help us operate the platform, with a family's chosen agency or caregiver to coordinate care, and
          as required by law or to protect our rights.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Your choices and rights</h2>
          <p>Depending on where you live, you may have rights to access, correct, or delete your personal
          information, and to opt out of certain uses. California residents may exercise rights under the
          CCPA/CPRA, including the right to know, delete, and opt out of the sale or sharing of personal
          information — which we do not do. To make a request, contact us using the details below.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Data retention and security</h2>
          <p>We keep information for as long as needed for the purposes described here and take reasonable
          measures to protect it. No method of transmission or storage is completely secure.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Not medical advice</h2>
          <p>The Care Royal is a technology platform and is not a healthcare provider. Content on our platform
          is not medical advice and is not a substitute for professional care.</p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl text-ink">Contact</h2>
          <p>Questions or requests: reach us through the contact details provided when we open in your area.
          We will update this notice as our services launch.</p>
        </section>
      </div>

      <div className="mt-10">
        <Link href="/" className="font-semibold text-brand">← Back to home</Link>
      </div>
    </main>
  );
}
