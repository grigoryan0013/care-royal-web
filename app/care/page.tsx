"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, publicPost } from "../lib/session";
import { withDefaults, heroStyle, type SiteConfig } from "../lib/site";

interface Review { rating: number; name: string; text: string; createdAt: string }
interface Agency { name: string; code: string }

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(n) ? "#39D2C0" : "none"} stroke="#39D2C0" strokeWidth="1.5"><path d="M12 2l3 6.5 7 .9-5 4.8 1.2 7L12 18l-6.4 3.2L6.8 14l-5-4.8 7-.9z" /></svg>
      ))}
    </span>
  );
}

export default function CarePage() {
  const [code, setCode] = useState("");
  const [agency, setAgency] = useState<Agency | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState(0); const [count, setCount] = useState(0);
  const [rv, setRv] = useState({ name: "", text: "", rating: 5 });
  const [sent, setSent] = useState(false);
  const [site, setSite] = useState<SiteConfig>(withDefaults(null));
  const [brandColor, setBrandColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const load = (c: string) => apiGet(`/api/agency-public?code=${encodeURIComponent(c)}`).then((d) => {
    setAgency(d.agency); setReviews(d.reviews || []); setAvg(d.avg || 0); setCount(d.count || 0);
    setSite(withDefaults(d.site)); setBrandColor(d.brandColor || ""); setLogoUrl(d.logoUrl || "");
  }).catch(() => {});

  useEffect(() => { const c = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("a") || "" : "").toUpperCase(); setCode(c); if (c) load(c); }, []);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    await publicPost("/api/review", { code, ...rv });
    setSent(true); setRv({ name: "", text: "", rating: 5 }); load(code);
  }

  if (!agency) return (
    <main className="app-bg flex min-h-screen items-center justify-center px-6 text-center">
      <div className="card max-w-md"><h1 className="font-serif text-xl text-ink">Agency page</h1><p className="mt-2 text-sm text-ink-light">Open this page with an agency link (e.g. /care?a=THEIRCODE).</p><Link href="/quote/" className="btn-primary mt-4 inline-flex">Request a quote</Link></div>
    </main>
  );

  const m = site.microsite;
  const hero = heroStyle(m.template, brandColor);
  const onDark = hero.dark;
  return (
    <main className="app-bg min-h-screen">
      <section className={hero.className} style={hero.style}>
        <div className="mx-auto max-w-4xl px-6 py-14">
          <div className="flex items-center gap-2">
            {logoUrl && <img src={logoUrl} alt={agency.name} className="h-9 w-9 rounded-full bg-white object-cover" />}
            <Link href="/" className={`text-sm ${onDark ? "text-white/70" : "text-ink-light"}`}>The Care Royal</Link>
          </div>
          <h1 className={`mt-3 font-serif text-4xl font-black tracking-tight md:text-5xl ${onDark ? "text-white" : "text-ink"}`}>{agency.name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <Stars n={avg} size={20} />
            <span className={onDark ? "text-white/90" : "text-ink-mid"}>{avg || "New"}{count ? ` · ${count} review${count === 1 ? "" : "s"}` : ""}</span>
          </div>
          <p className={`mt-4 max-w-xl ${onDark ? "text-white/85" : "text-ink-mid"}`}>{m.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/quote/?a=${agency.code}`} className={onDark ? "rounded-xl bg-white px-6 py-3 text-base font-bold text-brand shadow-pop transition hover:-translate-y-0.5" : "btn-gradient btn-lg"}>Request a free quote</Link>
            <Link href={`/apply/?a=${agency.code}`} className={onDark ? "rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/20" : "btn-ghost btn-lg"}>Work with us</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {m.about && (
          <div className="card mb-8">
            <h2 className="mb-2 font-serif text-2xl font-bold text-ink">About {agency.name}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-mid">{m.about}</p>
          </div>
        )}
        {m.showReviews && <>
        <h2 className="mb-4 font-serif text-2xl font-bold text-ink">What families say</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {reviews.length === 0 && <p className="text-sm text-ink-light">No reviews yet — be the first.</p>}
          {reviews.map((r, i) => (
            <div key={i} className="card">
              <Stars n={r.rating} />
              <p className="mt-2 text-sm text-ink-mid">{r.text}</p>
              <p className="mt-2 text-xs text-ink-light">— {r.name}</p>
            </div>
          ))}
        </div>

        <div className="card mt-8 max-w-lg">
          <h3 className="font-serif text-lg text-ink">Leave a review</h3>
          {sent && <p className="mt-2 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Thank you for your review.</p>}
          <form onSubmit={submitReview} className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="label !mb-0">Rating</span>
              {[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} onClick={() => setRv({ ...rv, rating: i })} aria-label={`${i} stars`}><svg width="24" height="24" viewBox="0 0 24 24" fill={i <= rv.rating ? "#39D2C0" : "none"} stroke="#39D2C0" strokeWidth="1.5"><path d="M12 2l3 6.5 7 .9-5 4.8 1.2 7L12 18l-6.4 3.2L6.8 14l-5-4.8 7-.9z" /></svg></button>)}
            </div>
            <input className="field" placeholder="Your name" value={rv.name} onChange={(e) => setRv({ ...rv, name: e.target.value })} required />
            <textarea className="field" rows={3} placeholder="Share your experience" value={rv.text} onChange={(e) => setRv({ ...rv, text: e.target.value })} required />
            <button className="btn-primary">Post review</button>
          </form>
        </div>
        </>}
      </div>
    </main>
  );
}
