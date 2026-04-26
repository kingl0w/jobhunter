import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // existing — DO NOT REMOVE until Phase 2 cleanup
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        accent: "var(--color-accent)",
        "accent-subtle": "var(--color-accent-subtle)",
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        muted: "var(--color-text-muted)",
        // editorial redesign — JH-007
        "ed-bg": "var(--bg)",
        "ed-surface": "var(--surface)",
        "ed-surface-2": "var(--surface-2)",
        "ed-inset": "var(--inset)",
        "ed-text": "var(--text)",
        "ed-muted": "var(--muted)",
        "ed-dim": "var(--dim)",
        "ed-accent": "var(--accent)",
        "ed-accent-dim": "var(--accent-dim)",
        "ed-accent-glow": "var(--accent-glow)",
        "ed-accent-15": "var(--accent-15)",
        "ed-accent-30": "var(--accent-30)",
        "ed-on-accent": "var(--on-accent)",
        "ed-green": "var(--green)",
        "ed-red": "var(--red)",
        "ed-yellow": "var(--yellow)",
        "ed-orange": "var(--orange)",
        "ed-tint-green": "var(--tint-green)",
        "ed-tint-red": "var(--tint-red)",
        "ed-tint-yellow": "var(--tint-yellow)",
        "ed-tint-orange": "var(--tint-orange)",
      },
      borderColor: {
        // existing
        strong: "var(--color-border)",
        subtle: "var(--color-border-subtle)",
        // editorial redesign — JH-007
        "ed-border": "var(--border)",
        "ed-border-2": "var(--border-2)",
        "ed-rule": "var(--rule)",
        "ed-accent-30": "var(--accent-30)",
      },
      fontFamily: {
        // unchanged variable names; --font-display now resolves to Fraunces, --font-body still Inter
        display: ["var(--font-display)", "Iowan Old Style", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        // new — JH-007
        mono: ["var(--font-mono)", "Geist Mono", "JetBrains Mono", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: {
        "ed-sm": "var(--radius-sm)",
        ed: "var(--radius)",
        "ed-md": "var(--radius-md)",
        "ed-lg": "var(--radius-lg)",
        "ed-xl": "var(--radius-xl)",
      },
      spacing: {
        "card-pad": "var(--card-pad)",
        "row-pad-y": "var(--row-pad-y)",
      },
      transitionDuration: {
        "ed-fast": "var(--dur-fast)",
        "ed-base": "var(--dur-base)",
        "ed-slow": "var(--dur-slow)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
