import Link from "next/link";
import Icon, { type IconName } from "../components/Icon";

const CATEGORIES: { t: string; d: string; icon: IconName }[] = [
  { t: "Child care & babysitting", d: "Sitters and nannies for date nights, after school, or full-time.", icon: "recipients" },
  { t: "Senior care", d: "Compassionate in-home help with daily living and companionship.", icon: "clients" },
  { t: "Special needs care", d: "Experienced caregivers for tailored, one-on-one support.", icon: "spark" },
  { t: "Pet care", d: "Trusted sitters and walkers for the pets you love.", icon: "profile" },
  { t: "Housekeeping", d: "Reliable help to keep your home clean and running.", icon: "building" },
  { t: "Tutoring & lessons", d: "Patient tutors to help kids learn and grow.", icon: "book" },
];

const STEPS: { t: string; d: string; icon: IconName }[] = [
  { t: "Tell us what you need", d: "Share the type of care, when you need it, and where.", icon: "search" },
  { t: "Get matched", d: "See caregivers near you and their experience and reviews.", icon: "staff" },
  { t: "Book & pay securely", d: "Message, schedule, and pay right inside Care Royal.", icon: "pay" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-deep/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2 text-white">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15 font-serif text-lg font-bold">C</span>
            <span className="font-serif text-lg font-bold tracking-tight">The Care Royal</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login/" className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white/85 hover:text-white">Sign in</Link>
            <Link href="/get-started/?intent=care" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand shadow-sm transition hover:shadow-pop">Join now</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/90">Care, on your terms</span>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">Find trusted care<br className="hidden sm:block" /> near you.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/80 sm:text-lg">Babysitters, nannies, senior care, pet care and housekeeping — real caregivers near you, ready to help. A better way to find and manage care.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/get-started/?intent=care" className="rounded-xl bg-white px-6 py-3 text-base font-bold text-brand shadow-pop transition hover:-translate-y-0.5">Find care</Link>
            <Link href="/get-started/?intent=work" className="rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10">Apply as a caregiver</Link>
          </div>
          <p className="mt-5 text-sm text-white/70">Free to join · Message and book securely · Cancel anytime</p>
        </div>
      </section>

      {/* Categories */}
      <section className="relative z-10 mx-auto -mt-16 max-w-6xl px-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Link key={c.t} href="/get-started/?intent=care" className="card card-hover group text-left">
              <div className="flex items-start gap-4">
                <span className="icon-badge"><Icon name={c.icon} /></span>
                <div>
                  <div className="font-serif text-lg font-bold text-ink">{c.t}</div>
                  <div className="mt-1 text-sm text-ink-light">{c.d}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 font-serif text-3xl font-black tracking-tight text-ink sm:text-4xl">Care in three simple <span className="text-gradient">steps</span></h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.t} className="card text-left">
              <div className="flex items-center justify-between">
                <span className="icon-badge"><Icon name={s.icon} /></span>
                <span className="font-serif text-4xl font-black text-rule-dark">{i + 1}</span>
              </div>
              <div className="mt-4 font-serif text-lg font-bold text-ink">{s.t}</div>
              <div className="mt-1 text-sm text-ink-light">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Two audiences */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card flex flex-col">
            <h3 className="font-serif text-2xl font-bold text-ink">Looking for care?</h3>
            <p className="mt-2 flex-1 text-sm text-ink-light">Tell us what you need and connect with caregivers near you. Message, schedule and pay securely — all in one place.</p>
            <Link href="/get-started/?intent=care" className="btn-gradient btn-lg mt-6 w-fit">Find care</Link>
          </div>
          <div className="card flex flex-col">
            <h3 className="font-serif text-2xl font-bold text-ink">Looking for care jobs?</h3>
            <p className="mt-2 flex-1 text-sm text-ink-light">Build your profile, set your availability and get discovered by families near you. Manage your schedule and get paid on time.</p>
            <Link href="/get-started/?intent=work" className="btn-ghost btn-lg mt-6 w-fit">Apply as a caregiver</Link>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="navy-band text-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { t: "Real profiles & reviews", d: "See experience, availability and ratings before you reach out.", icon: "profile" as IconName },
              { t: "Secure messaging & payments", d: "Talk, book and pay inside Care Royal — no cash, no hassle.", icon: "pay" as IconName },
              { t: "Care for every stage", d: "From newborns to seniors to pets — one place for all your care.", icon: "spark" as IconName },
            ].map((f) => (
              <div key={f.t}>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/15"><Icon name={f.icon} /></span>
                <div className="mt-4 font-serif text-lg font-bold">{f.t}</div>
                <div className="mt-1 text-sm text-white/75">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-rule bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-light">
          <span>The Care Royal — find and manage care you can trust.</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/get-started/?intent=care" className="hover:text-ink">Find care</Link>
            <Link href="/get-started/?intent=work" className="hover:text-ink">Become a caregiver</Link>
            <Link href="/agencies/" className="hover:text-ink">For agencies</Link>
            <Link href="/login/" className="hover:text-ink">Sign in</Link>
            <Link href="/terms/" className="hover:text-ink">Terms</Link>
            <Link href="/privacy/" className="hover:text-ink">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
