import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

// Editorial redesign foundation — JH-007.
// Fraunces is the display serif (variable weight, italic + opsz/SOFT/WONK axes).
// Inter is the body sans (variable weight).
// JetBrains_Mono substitutes for Geist Mono — Geist_Mono is not exported by
// next/font/google in Next 14.2.x. The CSS-side font-family stack in
// globals.css lists "Geist Mono" first as a literal so the look matches
// for users who have it installed locally; if a future Next upgrade adds
// Geist_Mono we can swap the loader without touching consumers.

export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
  weight: "variable",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: "variable",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: "variable",
});
