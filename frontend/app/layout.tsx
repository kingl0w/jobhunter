import type { Metadata } from "next";
import { fraunces, inter, jetbrainsMono } from "./lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "jobhunter",
  description: "Job search tracker and resume tailor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
