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
        serif: ["'Roboto'", "system-ui", "-apple-system", "sans-serif"],
        sans: ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
