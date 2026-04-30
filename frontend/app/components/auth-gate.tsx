"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useAuth } from "./auth-context";

const PUBLIC_PATHS = new Set<string>(["/login"]);

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (loading) {
    return (
      <main className="max-w-[1440px] mx-auto px-8 py-16 w-full">
        <p className="font-mono text-[11px] text-ed-muted">loading…</p>
      </main>
    );
  }

  if (isPublic) return <>{children}</>;
  if (!user) return null;
  return <>{children}</>;
}
