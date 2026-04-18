"use client";

import Link from "next/link";
import { memo } from "react";
import { Job } from "../types";

function scoreChipClass(score: number): string {
  if (score > 45) return "bg-green-500/30 text-green-50 border-green-400/60";
  if (score >= 30) return "bg-amber-500/30 text-amber-50 border-amber-400/60";
  return "bg-red-500/30 text-red-50 border-red-400/60";
}

const SITE_COLORS: Record<string, string> = {
  indeed: "bg-indigo-500/20 text-indigo-200",
  linkedin: "bg-sky-500/20 text-sky-200",
  zip_recruiter: "bg-green-500/20 text-green-200",
  google: "bg-orange-500/20 text-orange-200",
};

const STATUS_COLORS: Record<string, string> = {
  saved: "bg-surface-raised text-secondary",
  applied: "bg-violet-500/20 text-violet-200",
  phone_screen: "bg-cyan-500/20 text-cyan-200",
  interview: "bg-blue-500/20 text-blue-200",
  offer: "bg-emerald-500/20 text-emerald-200",
  rejected: "bg-red-500/20 text-red-200",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function JobRow({ job }: { job: Job }) {
  const scores = job.resume_scores || [];
  const bestScore =
    scores.length > 0 ? scores.reduce((a, b) => (a.score > b.score ? a : b)) : null;
  const topMatched = bestScore?.matched_keywords ?? [];
  const topMissing = bestScore?.missing_keywords ?? [];
  return (
    <div className="flex items-start gap-6 py-4 px-3 border-b-2 border-strong hover:bg-surface-raised/60 transition-colors">
      {/*left: title + meta + badges*/}
      <div className="flex-1 min-w-0">
        <Link
          href={`/jobs/${job.id}`}
          className="block font-display text-base font-medium text-primary hover:text-accent transition-colors line-clamp-1"
        >
          {job.title}
        </Link>
        <p className="text-secondary text-sm mt-0.5 line-clamp-1">
          {job.company}
          {job.location && (
            <span className="text-secondary"> &middot; {job.location}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span
            className={`text-xs uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${SITE_COLORS[job.site] || "bg-surface-raised text-secondary"}`}
          >
            {job.site.replace("_", " ")}
          </span>
          {bestScore && (
            <span className="text-xs uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-surface-raised text-secondary">
              {bestScore.label}
            </span>
          )}
          {job.is_remote && (
            <span className="text-xs uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-accent-subtle text-accent">
              remote
            </span>
          )}
          {job.application && (
            <span
              className={`text-xs uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[job.application.status] || "bg-surface-raised text-secondary"}`}
            >
              {job.application.status.replace("_", " ")}
            </span>
          )}
        </div>
      </div>

      {/*center: keywords*/}
      {bestScore && (
        <div className="hidden lg:flex flex-1 min-w-0 flex-wrap content-start gap-1 max-h-[56px] overflow-hidden">
          {topMatched.slice(0, 4).map((kw) => (
            <span
              key={`m-${kw}`}
              className="text-xs px-1.5 py-0.5 rounded bg-green-600/40 text-green-50 border border-green-500/50"
            >
              {kw}
            </span>
          ))}
          {topMissing.slice(0, 2).map((kw) => (
            <span
              key={`x-${kw}`}
              className="text-xs px-1.5 py-0.5 rounded border border-dashed border-strong text-secondary bg-surface-raised"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/*right: scores + actions*/}
      <div className="w-[200px] flex-shrink-0 flex flex-col items-end gap-2">
        {scores.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end">
            {scores.map((rs) => (
              <span
                key={rs.resume_id}
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${scoreChipClass(rs.score)}`}
              >
                {rs.label}: {Math.round(rs.score)}%
              </span>
            ))}
          </div>
        )}
        <span className="text-xs text-secondary">{formatDate(job.date_posted)}</span>
        <div className="flex flex-col gap-1.5 w-full">
          <Link
            href={`/jobs/${job.id}`}
            className="text-xs px-3 py-1.5 rounded bg-surface-raised text-secondary hover:text-primary transition-colors text-center"
          >
            View
          </Link>
          <a
            href={job.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded bg-accent text-primary hover:opacity-90 transition-opacity text-center"
          >
            Apply &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}

export default memo(JobRow);
