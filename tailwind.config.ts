import type { Config } from "tailwindcss";

// Care Royal — deep emerald + warm gold ("royal" care). No emojis anywhere in UI.
const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f1a17",
        "ink-soft": "#233631",
        "ink-mid": "#4b5f59",
        "ink-light": "#8aa39b",
        paper: "#f7faf8",
        brand: "#17705e",
        "brand-dark": "#0f5647",
        "brand-light": "#e8f2ef",
        gold: "#c9a86a",
        "gold-dark": "#a8873f",
        rule: "#dfe7e3",
        "rule-dark": "#c4d2cc",
        danger: "#b3452f",
        ok: "#2f7d4a",
      },
      fontFamily: {
        serif: ["Georgia", "'Times New Roman'", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
