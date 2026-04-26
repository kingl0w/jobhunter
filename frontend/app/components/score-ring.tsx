interface ScoreRingProps {
  score: number | null | undefined;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}

function colorFor(v: number): string {
  if (v >= 70) return "var(--green)";
  if (v >= 50) return "var(--accent)";
  if (v >= 35) return "var(--orange)";
  return "var(--red)";
}

export default function ScoreRing({
  score,
  size = 54,
  stroke = 4,
  showLabel = true,
}: ScoreRingProps) {
  const v = Math.max(0, Math.min(100, Number(score) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v / 100);
  const color = colorFor(v);

  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size, color }}
    >
      <svg
        width={size}
        height={size}
        className="block"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 400ms ease-out" }}
        />
      </svg>
      {showLabel && (
        <div
          className="absolute inset-0 grid place-items-center font-display italic font-semibold tracking-[-0.04em] leading-none"
          style={{ fontSize: size * 0.34, color: "var(--text)" }}
        >
          {Math.round(v)}
          <small
            className="font-mono not-italic font-medium uppercase ml-[2px]"
            style={{
              fontSize: "0.36em",
              color: "var(--muted)",
              letterSpacing: "0.1em",
            }}
          >
            %
          </small>
        </div>
      )}
    </div>
  );
}
