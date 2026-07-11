import Link from "next/link";

const features = [
  { t: "Family bookings", d: "Households manage multiple care recipients — parents, children, pets, home — and book any service. The agency approves every request." },
  { t: "Scheduling & clock-in", d: "Caregivers see their schedule and clock in and out with location stamps. The agency sees everything in one calendar." },
  { t: "Care documents", d: "Care plans, agreements, and consents — signed in-app with a full audit trail." },
  { t: "Payments & payroll", d: "Families pay in-app, the agency is paid, caregivers are paid. Timesheets flow straight into payroll." },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="font-serif text-2xl font-semibold tracking-tight text-brand">
          Care Royal
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login/" className="btn-ghost">Sign in</Link>
          <Link href="/login/?mode=signup" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">
            Care agency platform
          </p>
          <h1 className="font-serif text-5xl leading-[1.05] text-ink md:text-6xl">
            One platform to run your care agency end to end.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-mid">
            Families book care for the people and pets they love. Caregivers manage
            their schedule and pay. Your agency approves everything and gets paid —
            all in one place.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/login/?mode=signup" className="btn-primary px-6 py-3">Get started</Link>
            <Link href="/login/" className="btn-ghost px-6 py-3">Sign in</Link>
          </div>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.t} className="card">
              <h3 className="font-serif text-xl text-ink">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-mid">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-ink-light">
          Care Royal — a nationwide care management platform.
        </div>
      </footer>
    </main>
  );
}
