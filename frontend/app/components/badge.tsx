import type { ReactNode, CSSProperties } from "react";

type Variant = "neutral" | "accent" | "green" | "red" | "yellow" | "orange";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  style?: CSSProperties;
}

const VARIANT: Record<Variant, string> = {
  neutral: "text-ed-muted border-ed-border-2",
  accent: "bg-ed-accent-15 text-ed-accent border-ed-accent-30",
  green: "text-ed-green",
  red: "text-ed-red",
  yellow: "text-ed-yellow",
  orange: "text-ed-orange",
};

export default function Badge({
  variant = "neutral",
  children,
  style,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] px-2 py-[3px] rounded-ed border ${VARIANT[variant]}`}
      style={{
        ...(variant === "green" && {
          borderColor: "rgba(109,191,110,0.40)",
        }),
        ...(variant === "red" && { borderColor: "rgba(216,58,43,0.40)" }),
        ...(variant === "yellow" && {
          borderColor: "rgba(227,179,65,0.40)",
        }),
        ...(variant === "orange" && {
          borderColor: "rgba(224,138,60,0.40)",
        }),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
