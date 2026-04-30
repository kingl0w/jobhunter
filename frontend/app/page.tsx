"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJobs, fetchSyncStatus, getResumes } from "./api";
import JobCard from "./components/job-card";
import Icon from "./components/icon-svg";
import type { Job, Resume, SyncStatus } from "./types";

interface Filters {
  search: string;
  minScore: number;
  remoteOnly: boolean;
  hasSalary: boolean;
  sortBy: "score" | "date" | "company";
  source: "all" | "indeed" | "linkedin";
  resume: string;
  datePosted: "any" | "24h" | "3d" | "week";
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  minScore: 0,
  remoteOnly: false,
  hasSalary: false,
  sortBy: "score",
  source: "all",
  resume: "all",
  datePosted: "any",
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "never";
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

const SELECT_CLASS =
  "appearance-none bg-ed-inset border border-ed-border rounded-ed-md px-3 pr-7 py-2 text-[13px] text-ed-text font-body focus:outline-none focus:border-ed-accent transition-colors duration-ed-fast";

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const load = useCallback(async () => {
    try {
      const [jobList, status, resumeList] = await Promise.all([
        fetchJobs(),
        fetchSyncStatus(),
        getResumes(),
      ]);
      setJobs(jobList);
      setSyncStatus(status);
      setResumes(resumeList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo<Job[]>(() => {
    let result = [...jobs];
    const q = filters.search.toLowerCase();
    if (q) {
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q),
      );
    }
    if (filters.minScore > 0) {
      result = result.filter((j) => {
        const s = j.resume_scores || [];
        return (
          s.length > 0 && Math.max(...s.map((x) => x.score)) >= filters.minScore
        );
      });
    }
    if (filters.remoteOnly) result = result.filter((j) => j.is_remote);
    if (filters.source !== "all")
      result = result.filter((j) => j.site === filters.source);
    if (filters.resume !== "all") {
      result = result.filter((j) =>
        (j.resume_scores || []).some((s) => s.resume_id === filters.resume),
      );
    }
    if (filters.datePosted !== "any") {
      const W: Record<string, number> = {
        "24h": 86400000,
        "3d": 3 * 86400000,
        week: 7 * 86400000,
      };
      const cut = Date.now() - W[filters.datePosted];
      result = result.filter(
        (j) => j.date_posted && new Date(j.date_posted).getTime() >= cut,
      );
    }
    if (filters.hasSalary)
      result = result.filter(
        (j) => j.min_salary != null || j.max_salary != null,
      );

    const best = (j: Job) => {
      const s = j.resume_scores || [];
      return s.length ? Math.max(...s.map((x) => x.score)) : 0;
    };
    const scoreFor = (j: Job, rid: string) => {
      const m = (j.resume_scores || []).find((s) => s.resume_id === rid);
      return m ? m.score : 0;
    };
    result.sort((a, b) => {
      if (filters.resume !== "all")
        return scoreFor(b, filters.resume) - scoreFor(a, filters.resume);
      if (filters.sortBy === "score") return best(b) - best(a);
      if (filters.sortBy === "company") return a.company.localeCompare(b.company);
      return (
        new Date(b.date_fetched).getTime() - new Date(a.date_fetched).getTime()
      );
    });
    return result;
  }, [jobs, filters]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const lastSync = syncStatus?.finished_at
    ? fmtRelative(syncStatus.finished_at)
    : "never";

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-8 w-full">
      {!loading && resumes.length === 0 && (
        <div className="mb-7 p-4 rounded-ed-md border border-ed-accent/40 bg-ed-accent-15 flex items-center gap-4">
          <Icon name="upload" />
          <div className="flex-1 min-w-0">
            <div className="font-display italic font-semibold text-[16px] text-ed-text">
              upload a resume to start matching
            </div>
            <p className="font-mono text-[11px] text-ed-muted m-0 tracking-[0.04em]">
              jobs are scored against your resumes — without one, every match is 0.
            </p>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-ed-md bg-ed-accent text-ed-on-accent font-body text-[13px] font-semibold hover:bg-ed-accent-glow transition-colors duration-ed-fast"
          >
            go to settings
          </Link>
        </div>
      )}

      <div className="flex items-end justify-between gap-6 flex-wrap mb-7 pb-4 border-b border-ed-rule">
        <div>
          <h1 className="font-display italic font-bold text-[44px] tracking-[-0.035em] m-0 mb-1.5 text-ed-text leading-none">
            Jobs
          </h1>
          <p className="font-mono text-[11px] text-ed-muted m-0 tracking-[0.04em]">
            {filtered.length} of {jobs.length} jobs · last sync {lastSync} ·{" "}
            {resumes.length} resumes loaded
          </p>
        </div>
        <button
          onClick={() => setFilters(DEFAULT_FILTERS)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-ed-md font-body text-[13px] font-medium bg-ed-surface text-ed-text border border-ed-border hover:bg-ed-surface-2 hover:border-ed-border-2 transition-colors duration-ed-fast"
        >
          reset filters
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2.5 py-3.5 mb-6 items-center border-b border-ed-rule">
        <div className="relative flex-1 min-w-[240px] max-w-[360px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ed-muted flex">
            <Icon name="search" />
          </span>
          <input
            type="text"
            aria-label="Search jobs by title or company"
            placeholder="search title or company…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className="block w-full bg-ed-inset border border-ed-border rounded-ed-md pl-9 pr-3 py-2 text-[13px] text-ed-text placeholder:text-ed-dim font-body focus:outline-none focus:border-ed-accent transition-colors duration-ed-fast"
          />
        </div>
        <div className="w-px h-[18px] bg-ed-rule mx-1" aria-hidden />
        <div className="flex items-center gap-2">
          <label
            htmlFor="ms"
            className="font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-ed-muted"
          >
            min
          </label>
          <input
            id="ms"
            type="range"
            min={0}
            max={100}
            step={1}
            value={filters.minScore}
            onChange={(e) => set("minScore", Number(e.target.value))}
            className="w-24 accent-ed-accent"
            aria-valuetext={`${filters.minScore} percent`}
          />
          <span className="font-mono text-[11px] text-ed-text min-w-[28px]">
            {filters.minScore}%
          </span>
        </div>
        <div className="w-px h-[18px] bg-ed-rule mx-1" aria-hidden />

        <select
          aria-label="Source"
          value={filters.source}
          onChange={(e) => set("source", e.target.value as Filters["source"])}
          className={SELECT_CLASS}
        >
          <option value="all">all sources</option>
          <option value="indeed">indeed</option>
          <option value="linkedin">linkedin</option>
        </select>

        <select
          aria-label="Filter by resume"
          value={filters.resume}
          onChange={(e) => set("resume", e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="all">all resumes</option>
          {resumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label.toLowerCase()}
            </option>
          ))}
        </select>

        <select
          aria-label="Date posted"
          value={filters.datePosted}
          onChange={(e) =>
            set("datePosted", e.target.value as Filters["datePosted"])
          }
          className={SELECT_CLASS}
        >
          <option value="any">any time</option>
          <option value="24h">last 24h</option>
          <option value="3d">last 3 days</option>
          <option value="week">last week</option>
        </select>

        <select
          aria-label="Sort jobs by"
          value={filters.sortBy}
          onChange={(e) => set("sortBy", e.target.value as Filters["sortBy"])}
          className={SELECT_CLASS}
        >
          <option value="score">sort by score</option>
          <option value="date">sort by date</option>
          <option value="company">sort by company</option>
        </select>

        <label className="inline-flex items-center gap-2 cursor-pointer font-mono text-[11px] text-ed-muted tracking-[0.04em]">
          <input
            type="checkbox"
            checked={filters.remoteOnly}
            onChange={(e) => set("remoteOnly", e.target.checked)}
            className="w-3.5 h-3.5 accent-ed-accent"
          />
          <span>remote only</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer font-mono text-[11px] text-ed-muted tracking-[0.04em]">
          <input
            type="checkbox"
            checked={filters.hasSalary}
            onChange={(e) => set("hasSalary", e.target.checked)}
            className="w-3.5 h-3.5 accent-ed-accent"
          />
          <span>has salary</span>
        </label>
      </div>

      {/* Body */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 border-t border-l border-ed-rule">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border-r border-b border-ed-rule p-card-pad min-h-[240px] animate-pulse flex flex-col gap-4"
            >
              <div className="flex gap-3.5">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 bg-ed-surface rounded-ed-sm" />
                  <div className="h-5 w-3/4 bg-ed-surface rounded-ed-sm" />
                  <div className="h-3 w-1/2 bg-ed-surface rounded-ed-sm" />
                </div>
                <div className="w-[58px] h-[58px] rounded-full bg-ed-surface" />
              </div>
              <div className="flex gap-1 flex-wrap">
                <div className="h-5 w-16 bg-ed-surface rounded-ed-sm" />
                <div className="h-5 w-20 bg-ed-surface rounded-ed-sm" />
                <div className="h-5 w-12 bg-ed-surface rounded-ed-sm" />
              </div>
              <div className="mt-auto h-3 w-2/3 bg-ed-surface rounded-ed-sm" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="bg-ed-tint-red border border-ed-red text-ed-red rounded-ed-md p-4 text-[13px]">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="border border-dashed border-ed-border rounded-ed-md p-12 text-center">
          <p className="font-display italic text-[20px] text-ed-text mb-2">
            no jobs
          </p>
          <p className="font-mono text-[11px] text-ed-muted tracking-[0.04em] mb-5">
            {jobs.length === 0
              ? "trigger a sync from the masthead to fetch jobs"
              : "try adjusting your filters"}
          </p>
          {jobs.length > 0 && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-ed-md font-body text-[13px] font-medium bg-ed-surface text-ed-text border border-ed-border hover:bg-ed-surface-2 hover:border-ed-border-2 transition-colors duration-ed-fast"
            >
              reset filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 border-t border-l border-ed-rule">
          {filtered.map((j) => (
            <JobCard key={j.id} job={j} resumeFilter={filters.resume} />
          ))}
        </div>
      )}
    </main>
  );
}
