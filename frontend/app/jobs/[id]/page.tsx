"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  fetchJob,
  getResumes,
  resumeDownloadUrl,
  tailorResume,
  updateJobStatus,
} from "../../api";
import {
  APPLICATION_STATUSES,
  ApplicationRead,
  ApplicationStatus,
  Job,
  Resume,
  TailorResponse,
} from "../../types";

const STATUS_COLORS: Record<string, { bg: string; active: string }> = {
  saved: { bg: "bg-surface-raised text-secondary", active: "bg-secondary text-bg" },
  applied: { bg: "bg-violet-500/20 text-violet-200", active: "bg-violet-600 text-primary" },
  phone_screen: { bg: "bg-cyan-500/20 text-cyan-200", active: "bg-cyan-600 text-primary" },
  interview: { bg: "bg-blue-500/20 text-blue-200", active: "bg-blue-600 text-primary" },
  offer: { bg: "bg-emerald-500/20 text-emerald-200", active: "bg-emerald-600 text-primary" },
  rejected: { bg: "bg-red-500/20 text-red-200", active: "bg-red-600 text-primary" },
};

function scoreChipClass(score: number): string {
  if (score > 60) return "bg-green-500/30 text-green-50 border-green-400/60";
  if (score >= 40) return "bg-amber-500/30 text-amber-50 border-amber-400/60";
  return "bg-red-500/30 text-red-50 border-red-400/60";
}

function scoreTextColor(score: number): string {
  if (score > 60) return "text-green-300";
  if (score >= 40) return "text-amber-200";
  return "text-red-200";
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

function DetailSkeleton() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 animate-pulse">
      <div className="h-3 w-24 bg-surface-raised rounded mb-6" />
      <div className="space-y-3 mb-8">
        <div className="h-7 w-2/3 bg-surface-raised rounded" />
        <div className="h-4 w-1/2 bg-surface-raised rounded" />
        <div className="flex gap-2 pt-2">
          <div className="h-5 w-20 bg-surface-raised rounded" />
          <div className="h-5 w-20 bg-surface-raised rounded" />
          <div className="h-5 w-28 bg-surface-raised rounded" />
        </div>
        <div className="flex gap-2 pt-3">
          <div className="h-8 w-24 bg-surface-raised rounded" />
          <div className="h-8 w-32 bg-surface-raised rounded" />
          <div className="h-8 w-28 bg-surface-raised rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-4 w-32 bg-surface-raised rounded" />
          <div className="h-3 w-full bg-surface-raised rounded" />
          <div className="h-3 w-full bg-surface-raised rounded" />
          <div className="h-3 w-5/6 bg-surface-raised rounded" />
          <div className="h-3 w-4/6 bg-surface-raised rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-24 bg-surface-raised rounded" />
          <div className="h-20 w-full bg-surface-raised rounded" />
        </div>
      </div>
    </main>
  );
}

export default function JobDetail() {
  const params = useParams();
  const id = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorResult, setTailorResult] = useState<TailorResponse | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const loadJob = useCallback(async () => {
    try {
      const [data, resumeList] = await Promise.all([fetchJob(id), getResumes()]);
      setJob(data);
      setResumes(resumeList);
      setNotes(data.application?.notes || "");
      setSelectedResumeId((prev) => {
        if (prev) return prev;
        if (data.resume_scores && data.resume_scores.length > 0) {
          return data.resume_scores.reduce((a, b) => (a.score > b.score ? a : b))
            .resume_id;
        }
        return resumeList[0]?.id ?? "";
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const handleStatusChange = async (status: ApplicationStatus) => {
    if (!job) return;
    const previousApp = job.application;
    const optimistic: ApplicationRead = {
      job_id: job.id,
      status,
      resume_used: previousApp?.resume_used ?? null,
      notes: previousApp?.notes ?? null,
      applied_at: previousApp?.applied_at ?? null,
      updated_at: new Date().toISOString(),
    };
    setJob({ ...job, application: optimistic });

    try {
      await updateJobStatus(job.id, { status });
    } catch (e) {
      console.error("failed to update status:", e);
      setJob((j) => (j ? { ...j, application: previousApp } : j));
    }
  };

  const handleNotesSave = async () => {
    if (!job) return;
    setSavingNotes(true);
    try {
      await updateJobStatus(job.id, { notes });
    } catch (e) {
      console.error("failed to save notes:", e);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleTailor = async () => {
    if (!job || !selectedResumeId) return;
    setTailoring(true);
    try {
      const result = await tailorResume(job.id, selectedResumeId);
      setTailorResult(result);
      await loadJob();
    } catch (e) {
      console.error("failed to tailor:", e);
    } finally {
      setTailoring(false);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="text-sm text-muted hover:text-primary mb-4 inline-block"
        >
          &larr; Back
        </Link>
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-4 text-sm">
          {error || "Job not found"}
        </div>
      </div>
    );
  }

  const salary = formatSalary(job.min_salary, job.max_salary);
  const currentStatus = job.application?.status || "saved";
  const scores = job.resume_scores || [];
  const bestScore =
    scores.length > 0 ? scores.reduce((a, b) => (a.score > b.score ? a : b)) : null;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <nav aria-label="Breadcrumb">
        <Link
          href="/"
          className="text-sm text-muted hover:text-primary mb-4 inline-block"
        >
          &larr; Back to jobs
        </Link>
      </nav>

      {/* header */}
      <header className="pb-6 border-b border-subtle">
        <h1 className="font-display text-3xl font-bold text-primary">{job.title}</h1>
        <p className="text-secondary mt-1 font-display">
          {job.company}
          {job.location && (
            <span className="text-muted"> &middot; {job.location}</span>
          )}
          {job.is_remote && (
            <span className="ml-2 text-xs uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-accent-subtle text-accent">
              remote
            </span>
          )}
        </p>
        {salary && (
          <p className="text-emerald-300 text-sm mt-1">{salary}</p>
        )}

        {scores.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {scores.map((rs) => (
              <span
                key={rs.resume_id}
                className={`text-xs font-semibold px-2 py-1 rounded border ${scoreChipClass(rs.score)}`}
              >
                {rs.label}: {Math.round(rs.score)}%
              </span>
            ))}
            {bestScore && (
              <span className="text-xs font-semibold px-2 py-1 rounded border bg-accent-subtle text-accent border-strong uppercase tracking-wider">
                Best: {bestScore.label}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-5">
          <a
            href={job.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 rounded bg-accent text-primary text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Apply &rarr;
          </a>
          <a
            href={resumeDownloadUrl(job.id, selectedResumeId || undefined)}
            className="px-4 py-1.5 rounded bg-surface-raised text-secondary text-sm hover:text-primary transition-colors border border-subtle"
          >
            Download Resume
          </a>
          {resumes.length > 0 && (
            <select
              aria-label="Select resume to tailor"
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="bg-surface-raised border border-subtle rounded px-3 py-1.5 text-sm text-secondary focus:outline-none focus:border-strong"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleTailor}
            disabled={tailoring || !selectedResumeId}
            className="px-4 py-1.5 rounded bg-surface-raised text-secondary text-sm hover:text-primary transition-colors border border-subtle disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {tailoring ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
                Tailoring...
              </span>
            ) : (
              "Tailor Resume"
            )}
          </button>
        </div>
      </header>

      {tailorResult && (
        <div className="py-4 border-b border-subtle">
          <p className="text-sm text-emerald-200 font-medium mb-1">
            Resume tailored successfully ({tailorResult.label})
          </p>
          <p className="text-sm text-secondary mb-1">{tailorResult.summary}</p>
          <p className="text-xs text-muted">
            Saved to: {tailorResult.file_path}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* main */}
        <div className="lg:col-span-2">
          {scores.length > 0 && (
            <section className="py-6 border-b border-subtle">
              <h2 className="font-display text-xs font-semibold text-muted mb-4 uppercase tracking-widest">
                Score Breakdown
              </h2>
              <div
                className="grid gap-6 mb-5"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(scores.length, 3)}, minmax(0, 1fr))`,
                }}
              >
                {scores.map((rs) => (
                  <div key={rs.resume_id}>
                    <div className="text-xs text-muted mb-1">{rs.label}</div>
                    <div className={`text-2xl font-bold ${scoreTextColor(rs.score)}`}>
                      {rs.score.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>

              {bestScore && (
                <>
                  <div className="mb-4">
                    <div className="text-xs text-muted mb-1.5">
                      Matched ({bestScore.matched_keywords.length}) — {bestScore.label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {bestScore.matched_keywords.map((kw) => (
                        <span
                          key={kw}
                          className="text-xs px-2 py-0.5 rounded bg-green-600/40 text-green-50 border border-green-500/50"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted mb-1.5">
                      Missing ({bestScore.missing_keywords.length}) — {bestScore.label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {bestScore.missing_keywords.map((kw) => (
                        <span
                          key={kw}
                          className="text-xs px-2 py-0.5 rounded border border-dashed border-strong text-secondary bg-surface-raised"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {job.description && (
            <section className="py-6">
              <h2 className="font-display text-xs font-semibold text-muted mb-4 uppercase tracking-widest">
                Description
              </h2>
              <div
                tabIndex={0}
                role="region"
                aria-label="Job description"
                className="max-h-[600px] overflow-y-auto pr-2 prose prose-sm prose-invert max-w-none [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:text-secondary [&_li]:text-secondary [&_strong]:text-primary [&_a]:text-accent"
              >
                <ReactMarkdown>{job.description}</ReactMarkdown>
              </div>
            </section>
          )}
        </div>

        {/* sidebar */}
        <aside className="lg:border-l lg:border-subtle lg:pl-8">
          <section className="py-6 border-b border-subtle">
            <h2 className="font-display text-xs font-semibold text-muted mb-3 uppercase tracking-widest">
              Application Status
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {APPLICATION_STATUSES.map((status) => {
                const isCurrent = status === currentStatus;
                const colors = STATUS_COLORS[status];
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                      isCurrent ? colors.active : colors.bg
                    }`}
                  >
                    {status.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="py-6 border-b border-subtle">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xs font-semibold text-muted uppercase tracking-widest">Notes</h2>
              {savingNotes && (
                <span className="text-xs text-muted">saving...</span>
              )}
            </div>
            <textarea
              aria-label="Application notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesSave}
              rows={6}
              placeholder="Add notes about this application..."
              className="w-full bg-surface-raised border border-subtle rounded px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-strong transition-colors resize-none"
            />
          </section>

          <section className="py-6">
            <h2 className="font-display text-xs font-semibold text-muted mb-3 uppercase tracking-widest">Details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted text-xs">Source</dt>
                <dd className="text-secondary">{job.site}</dd>
              </div>
              {job.job_type && (
                <div>
                  <dt className="text-muted text-xs">Type</dt>
                  <dd className="text-secondary">{job.job_type}</dd>
                </div>
              )}
              {job.date_posted && (
                <div>
                  <dt className="text-muted text-xs">Posted</dt>
                  <dd className="text-secondary">
                    {new Date(job.date_posted).toLocaleDateString()}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted text-xs">Fetched</dt>
                <dd className="text-secondary">
                  {new Date(job.date_fetched).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
