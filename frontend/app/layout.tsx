import type { Metadata } from "next";
import { fraunces, inter, jetbrainsMono } from "./lib/fonts";
import { AuthProvider } from "./components/auth-context";
import AuthGate from "./components/auth-gate";
import Topnav from "./components/topnav";
import { ToastStack } from "./components/toast";
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
        <AuthProvider>
          <Topnav />
          <AuthGate>{children}</AuthGate>
          <ToastStack />
        </AuthProvider>
      </body>
    </html>
  );
}
