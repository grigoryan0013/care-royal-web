import type { Config } from "tailwindcss";

// Care Royal — matches the landing page: indigo #4B39EF brand with a purple/navy
// hero gradient and teal accent. No emojis anywhere in UI.
const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14181B",
        "ink-soft": "#232838",
        "ink-mid": "#57636C",
        "ink-light": "#8b95a1",
        paper: "#f1f4f8",
        brand: "#4B39EF",
        "brand-dark": "#3826c9",
        "brand-light": "#ecebfd",
        "brand-deep": "#0D0459",
        "brand-purple": "#673AB7",
        gold: "#39D2C0",
        "gold-dark": "#2bb3a3",
        rule: "#E0E3E7",
        "rule-dark": "#cdd3da",
        danger: "#d64545",
        ok: "#1f9d55",
      },
      fontFamily: {
        serif: ["'Fraunces'", "Georgia", "'Times New Roman'", "serif"],
        sans: ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,18,27,0.04), 0 4px 16px -8px rgba(16,18,27,0.10)",
        pop: "0 12px 40px -12px rgba(16,18,27,0.28)",
        brand: "0 8px 24px -10px rgba(75,57,239,0.55)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.25s cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
export default config;
