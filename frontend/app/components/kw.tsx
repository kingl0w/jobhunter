import type { ReactNode } from "react";

interface KwProps {
  variant: "matched" | "missing";
  children: ReactNode;
}

export default function Kw({ variant, children }: KwProps) {
  if (variant === "matched") {
    return (
      <span className="inline-flex items-center font-mono text-[11px] px-2 py-[2px] rounded-ed border text-ed-text border-ed-text bg-transparent whitespace-nowrap">
        <span className="text-ed-green mr-[2px]">✓</span>
        {children}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center font-mono text-[11px] px-2 py-[2px] rounded-ed border border-dashed text-ed-muted border-ed-border bg-transparent whitespace-nowrap">
      {children}
    </span>
  );
}
