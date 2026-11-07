import type { Config } from "tailwindcss";

const v = (name: string) => `var(--${name})`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: v("paper"), card: v("card"), card2: v("card-2"), ink: v("ink"), ink2: v("ink-2"), muted: v("muted"),
        line: v("line"), teal: v("teal"), tealink: v("teal-ink"), tealsoft: v("teal-soft"),
        amber: v("amber"), ambersoft: v("amber-soft"), red: v("red"), redsoft: v("red-soft"),
        green: v("green"), greensoft: v("green-soft"), neutralsoft: v("neutral-soft"),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', '"Figtree Variable"', "system-ui", "sans-serif"],
        body: ['"Figtree Variable"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { card: "14px" },
      boxShadow: { card: "0 1px 2px rgba(16,48,44,.06), 0 6px 20px rgba(16,48,44,.07)" },
    },
  },
  plugins: [],
} satisfies Config;
