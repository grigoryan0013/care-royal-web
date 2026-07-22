// Per-agency public-site config: the shareable microsite, the quote form, and the
// apply/hiring page. Owner edits these in Grow & brand; the public pages render them.

export interface MicrositeCfg { template: string; tagline: string; about: string; showReviews: boolean }
export interface QuoteCfg { template: string; headline: string; intro: string; fields: Record<string, boolean> }
export interface ApplyCfg { template: string; headline: string; intro: string }
export interface SiteConfig { microsite: MicrositeCfg; quote: QuoteCfg; apply: ApplyCfg }

// Four page "looks" the owner can choose from (expandable later).
export const SITE_TEMPLATES: { key: string; label: string }[] = [
  { key: "warm", label: "Warm" },
  { key: "classic", label: "Classic" },
  { key: "bold", label: "Bold" },
  { key: "minimal", label: "Minimal" },
];

// Optional quote-form fields the owner can show/hide (contact fields are always on).
export const QUOTE_OPTIONAL_FIELDS: { key: string; label: string }[] = [
  { key: "services", label: "Type-of-care checklist" },
  { key: "frequency", label: "How often" },
  { key: "startDate", label: "Ideal start date" },
  { key: "schedule", label: "Schedule preferences" },
  { key: "bestTime", label: "Best time to reach you" },
  { key: "details", label: "“Anything else” box" },
];

export function defaultSite(): SiteConfig {
  return {
    microsite: {
      template: "warm",
      tagline: "Trusted in-home care — personal care, companionship, skilled nursing and more, coordinated end to end.",
      about: "",
      showReviews: true,
    },
    quote: {
      template: "warm",
      headline: "Tell us about the care you need",
      intro: "No account needed. Share a few details and we’ll build a personalized care plan and quote for you.",
      fields: { services: true, frequency: true, startDate: true, schedule: true, bestTime: true, details: true },
    },
    apply: {
      template: "warm",
      headline: "Join our care team",
      intro: "Tell us about yourself and your experience — we’ll be in touch about roles that fit.",
    },
  };
}

// Merge a stored (possibly partial) config over the defaults so old tenants stay valid.
export function withDefaults(s: Partial<SiteConfig> | null | undefined): SiteConfig {
  const d = defaultSite();
  if (!s) return d;
  return {
    microsite: { ...d.microsite, ...(s.microsite || {}) },
    quote: { ...d.quote, ...(s.quote || {}), fields: { ...d.quote.fields, ...((s.quote || {}).fields || {}) } },
    apply: { ...d.apply, ...(s.apply || {}) },
  };
}

// Hero styling per template. `dark` = use light text on the hero.
export function heroStyle(template: string, brandColor?: string): { className: string; style?: React.CSSProperties; dark: boolean } {
  switch (template) {
    case "minimal": return { className: "bg-white border-b border-rule", dark: false };
    case "classic": return { className: "navy-band", dark: true };
    case "bold": return { className: brandColor ? "" : "bg-brand", style: brandColor ? { background: brandColor } : undefined, dark: true };
    default: return { className: "hero-gradient", dark: true }; // warm
  }
}
