"use client";

import Link from "next/link";
import { memo } from "react";
import type { Job } from "../types";
import ScoreRing from "./score-ring";
import Badge from "./badge";
import Kw from "./kw";

function fmtSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const f = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  if (min && max) return `${f(min)}–${f(max)}`;
  if (min) return `${f(min)}+`;
  return `up to ${f(max!)}`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const STATUS_STRIPE: Record<string, string> = {
  applied: "bg-ed-accent",
  phone_screen: "bg-ed-yellow",
  interview: "bg-ed-orange",
  offer: "bg-ed-green",
  rejected: "bg-ed-rule",
};

const STATUS_PIP: Record<string, string> = {
  saved: "var(--muted)",
  applied: "var(--accent)",
  phone_screen: "var(--yellow)",
  interview: "var(--orange)",
  offer: "var(--green)",
  rejected: "var(--red)",
};

interface JobCardProps {
  job: Job;
  resumeFilter: string;
}

function JobCardImpl({ job, resumeFilter }: JobCardProps) {
  const scores = job.resume_scores || [];
  const focusScore =
    resumeFilter !== "all"
      ? scores.find((s) => s.resume_id === resumeFilter)
      : scores.length
        ? scores.reduce((a, b) => (b.score > a.score ? b : a))
        : null;
  const otherScores = focusScore
    ? scores.filter((s) => s.resume_id !== focusScore.resume_id)
    : scores;
  const matched = focusScore?.matched_keywords?.slice(0, 4) ?? [];
  const missing = focusScore?.missing_keywords?.slice(0, 2) ?? [];
  const status = job.application?.status;
  const salary = fmtSalary(job.min_salary, job.max_salary);
  const stripeClass = status
    ? (STATUS_STRIPE[status] ?? "bg-transparent")
    : "bg-transparent";

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="relative flex flex-col gap-4 p-card-pad min-h-[240px] border-r border-b border-ed-rule cursor-pointer transition-colors duration-ed-fast hover:bg-ed-surface text-left overflow-hidden"
    >
      {/* status stripe */}
      <span
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${stripeClass}`}
      />

      {/* head */}
      <div className="flex gap-3.5 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge>{job.site.replace(/_/g, " ")}</Badge>
            {job.is_remote && <Badge variant="accent">remote</Badge>}
            {status && status !== "saved" && (
              <span
                className="inline-flex items-center gap-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] px-2 py-[3px] rounded-ed border"
                style={{
                  color: STATUS_PIP[status],
                  borderColor: STATUS_PIP[status],
                  background: "transparent",
                }}
              >
                {status.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <h3 className="font-display text-[22px] font-semibold tracking-[-0.025em] text-ed-text m-0 leading-[1.1] line-clamp-2">
            {job.title}
          </h3>
          <p className="font-body text-[13px] text-ed-muted mt-0.5 mb-0">
            <strong className="text-ed-text font-semibold">
              {job.company}
            </strong>
            {job.location ? ` · ${job.location}` : ""}
          </p>
        </div>
        {focusScore && (
          <div className="flex flex-col items-center gap-1.5">
            <ScoreRing score={focusScore.score} size={58} stroke={4} />
            <div className="font-mono text-[9px] text-ed-muted uppercase tracking-[0.08em] whitespace-nowrap">
              {focusScore.label}
            </div>
          </div>
        )}
      </div>

      {/* keywords */}
      {focusScore && (matched.length > 0 || missing.length > 0) && (
        <div className="flex flex-wrap gap-1 min-h-[22px]">
          {matched.map((k) => (
            <Kw key={`m-${k}`} variant="matched">
              {k}
            </Kw>
          ))}
          {missing.map((k) => (
            <Kw key={`x-${k}`} variant="missing">
              {k}
            </Kw>
          ))}
        </div>
      )}

      {/* foot */}
      <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-dashed border-ed-border mt-auto font-mono text-[11px] text-ed-muted">
        <div className="flex flex-wrap gap-3.5 items-center">
          {salary && <span className="text-ed-green">{salary}</span>}
          <span>{fmtRelative(job.date_posted)}</span>
          {otherScores.map((s) => (
            <span key={s.resume_id}>
              {s.label.toLowerCase()}: {Math.round(s.score)}%
            </span>
          ))}
        </div>
        <span className="inline-grid place-items-center min-w-[18px] h-[18px] px-1.5 font-mono text-[10px] font-medium bg-ed-inset border border-ed-border rounded-ed-sm text-ed-muted">
          ↵
        </span>
      </div>
    </Link>
  );
}

const JobCard = memo(JobCardImpl);
export default JobCard;
