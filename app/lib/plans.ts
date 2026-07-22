// Shared plan definitions — used by the public pricing/signup page and (later)
// the in-portal billing card. To turn on subscription billing, paste each plan's
// Stripe Payment Link URL into PAYMENT_LINKS below; the buttons wire up automatically.
export interface Plan {
  key: string;
  name: string;
  price: number;         // USD / month
  caregivers: string;
  tagline: string;
  features: string[];
  popular?: boolean;
}

export const TRIAL_DAYS = 30;

export const PLANS: Plan[] = [
  {
    key: "standard",
    name: "Standard",
    price: 49,
    caregivers: "Up to 10 caregivers",
    tagline: "Everything to run a small agency.",
    features: [
      "Scheduling & GPS clock-in",
      "Clients & caregivers",
      "Care plans & e-signature",
      "Document studio + paystubs (real tax math)",
      "Take family payments (Stripe)",
      "In-app payroll",
      "Reviews & reporting",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 99,
    caregivers: "Up to 30 caregivers",
    tagline: "For growing agencies.",
    popular: true,
    features: [
      "Everything in Standard",
      "QuickBooks sync",
      "Recruiting & applications",
      "Priority support",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 199,
    caregivers: "Unlimited caregivers",
    tagline: "Multi-location operations.",
    features: [
      "Everything in Pro",
      "Multiple locations",
      "White-label branding",
      "Custom domain",
    ],
  },
];

// Stripe Payment Link URL per plan key. Leave "" until you create them in Stripe;
// buttons then start the free trial instead of linking out.
export const PAYMENT_LINKS: Record<string, string> = {
  standard: "https://buy.stripe.com/dRm5kC10x247gsn6ApcV20g",
  pro: "https://buy.stripe.com/dRmfZgbFb5gj0tp1g5cV20j",
  enterprise: "https://buy.stripe.com/00w4gy4cJ9wz6RNbUJcV20i",
};

export const planByKey = (key: string) => PLANS.find((p) => p.key === key);
