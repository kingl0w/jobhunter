"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJobs, fetchSyncStatus, getResumes, triggerSync } from "./api";
import JobRow from "./components/job-card";
import { Job, Resume, SyncStatus } from "./types";

function JobRowSkeleton() {
  return (
    <div className="flex items-start gap-6 py-4 border-b border-subtle animate-pulse">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-2/3 bg-surface-raised rounded" />
        <div className="h-3 w-1/2 bg-surface-raised rounded" />
        <div className="flex gap-1.5 pt-1">
          <div className="h-4 w-14 bg-surface-raised rounded" />
          <div className="h-4 w-10 bg-surface-raised rounded" />
        </div>
      </div>
      <div className="hidden lg:flex flex-1 flex-wrap gap-1">
        <div className="h-4 w-16 bg-surface-raised rounded" />
        <div className="h-4 w-20 bg-surface-raised rounded" />
        <div className="h-4 w-14 bg-surface-raised rounded" />
        <div className="h-4 w-12 bg-surface-raised rounded" />
      </div>
      <div className="w-[200px] flex-shrink-0 space-y-2">
        <div className="flex gap-1.5 justify-end">
          <div className="h-5 w-16 bg-surface-raised rounded" />
          <div className="h-5 w-16 bg-surface-raised rounded" />
        </div>
        <div className="h-3 w-14 bg-surface-raised rounded ml-auto" />
        <div className="h-7 w-full bg-surface-raised rounded" />
        <div className="h-7 w-full bg-surface-raised rounded" />
      </div>
    </div>
  );
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "score" | "company">("date");
  const [source, setSource] = useState<"all" | "indeed" | "linkedin" | "zip_recruiter" | "google">("all");
  const [resumeFilter, setResumeFilter] = useState<string>("all");
  const [datePosted, setDatePosted] = useState<"any" | "24h" | "3d" | "week">("any");
  const [hasSalary, setHasSalary] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

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
    console.log("[page mount] initial minScore=", minScore, "resumeFilter=", resumeFilter);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      const poll = setInterval(async () => {
        const status = await fetchSyncStatus();
        setSyncStatus(status);
        if (status.status !== "running") {
          clearInterval(poll);
          setSyncing(false);
          load();
        }
      }, 3000);
    } catch {
      setSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...jobs];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q)
      );
    }

    if (minScore > 0) {
      result = result.filter((j) => {
        const scores = j.resume_scores || [];
        if (scores.length === 0) return false;
        return Math.max(...scores.map((s) => s.score)) >= minScore;
      });
    }

    if (remoteOnly) {
      result = result.filter((j) => j.is_remote);
    }

    if (source !== "all") {
      result = result.filter((j) => j.site === source);
    }

    if (resumeFilter !== "all") {
      result = result.filter((j) =>
        (j.resume_scores || []).some((s) => s.resume_id === resumeFilter)
      );
    }

    if (datePosted !== "any") {
      const now = Date.now();
      const windows: Record<string, number> = {
        "24h": 24 * 60 * 60 * 1000,
        "3d": 3 * 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
      };
      const cutoff = now - windows[datePosted];
      result = result.filter((j) => {
        if (!j.date_posted) return false;
        return new Date(j.date_posted).getTime() >= cutoff;
      });
    }

    if (hasSalary) {
      result = result.filter((j) => j.min_salary != null || j.max_salary != null);
    }

    const bestFor = (j: Job): number => {
      const s = j.resume_scores || [];
      return s.length ? Math.max(...s.map((x) => x.score)) : 0;
    };
    const scoreFor = (j: Job, resumeId: string): number => {
      const match = (j.resume_scores || []).find((s) => s.resume_id === resumeId);
      return match ? match.score : 0;
    };

    result.sort((a, b) => {
      if (resumeFilter !== "all") {
        return scoreFor(b, resumeFilter) - scoreFor(a, resumeFilter);
      }
      if (sortBy === "score") {
        return bestFor(b) - bestFor(a);
      }
      if (sortBy === "company") {
        return a.company.localeCompare(b.company);
      }
      return (
        new Date(b.date_fetched).getTime() -
        new Date(a.date_fetched).getTime()
      );
    });

    return result;
  }, [jobs, search, minScore, remoteOnly, sortBy, source, resumeFilter, datePosted, hasSalary]);

  const lastSyncTime = syncStatus?.finished_at
    ? new Date(syncStatus.finished_at).toLocaleString()
    : "never";

  const maxScore = 100;

  const selectClass =
    "bg-surface-raised border border-strong rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent";

  return (
    <main className="px-6 py-6">
      <header>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-primary">jobhunter</h1>
            <p className="text-xs text-secondary mt-1">
              {filtered.length} jobs
              {jobs.length !== filtered.length && (
                <span> / {jobs.length} total</span>
              )}
              <span> &middot; last sync: {lastSyncTime}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 rounded bg-accent text-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {syncing ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Syncing...
                </span>
              ) : (
                "Find Jobs"
              )}
            </button>
            <Link
              href="/settings"
              className="px-4 py-2 rounded bg-surface-raised text-secondary text-sm font-semibold hover:text-primary transition-colors border border-subtle"
            >
              Settings
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center py-3 border-y border-subtle">
          <input
            type="text"
            aria-label="Search jobs by title or company"
            placeholder="Search title or company..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 min-w-[240px] bg-surface-raised border border-strong rounded px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />

          <div className="flex items-center gap-2">
            <label htmlFor="min-score" className="text-xs text-muted whitespace-nowrap">
              Min score
            </label>
            <input
              id="min-score"
              type="range"
              min={0}
              max={maxScore}
              step={1}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-24 accent-accent"
              aria-valuetext={`${minScore} percent`}
            />
            <span className="text-xs text-secondary w-8 text-right">
              {minScore}%
            </span>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="w-4 h-4 rounded border-subtle bg-surface-raised accent-accent"
            />
            <span className="text-xs text-secondary">Remote only</span>
          </label>

          <select
            aria-label="Sort jobs by"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "date" | "score" | "company")
            }
            className={selectClass}
          >
            <option value="date">Date</option>
            <option value="score">Score</option>
            <option value="company">Company</option>
          </select>

          <select
            aria-label="Source"
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className={selectClass}
          >
            <option value="all">All Sources</option>
            <option value="indeed">Indeed</option>
            <option value="linkedin">LinkedIn</option>
            <option value="zip_recruiter">ZipRecruiter</option>
            <option value="google">Google</option>
          </select>

          <select
            aria-label="Filter by resume"
            value={resumeFilter}
            onChange={(e) => setResumeFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All Resumes</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Date posted"
            value={datePosted}
            onChange={(e) => setDatePosted(e.target.value as typeof datePosted)}
            className={selectClass}
          >
            <option value="any">Any Time</option>
            <option value="24h">Last 24h</option>
            <option value="3d">Last 3 Days</option>
            <option value="week">Last Week</option>
          </select>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hasSalary}
              onChange={(e) => setHasSalary(e.target.checked)}
              className="w-4 h-4 rounded border-subtle bg-surface-raised accent-accent"
            />
            <span className="text-xs text-secondary">Has salary</span>
          </label>
        </div>
      </header>

      {loading && (
        <div>
          {Array.from({ length: 6 }).map((_, i) => (
            <JobRowSkeleton key={i} />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-4 my-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="py-20 text-secondary">
          <p className="text-lg mb-2 font-display">No jobs found</p>
          <p className="text-sm text-muted">
            {jobs.length === 0
              ? 'Click "Find Jobs" to fetch jobs'
              : "Try adjusting your filters"}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div>
          {filtered.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </main>
  );
}
