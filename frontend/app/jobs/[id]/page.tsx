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
import ScoreRing from "../../components/score-ring";
import Badge from "../../components/badge";
import Kw from "../../components/kw";
import Icon from "../../components/icon-svg";
import { useToast } from "../../components/toast";

const STATUS_PIP: Record<string, string> = {
  saved: "var(--muted)",
  applied: "var(--accent)",
  phone_screen: "var(--yellow)",
  interview: "var(--orange)",
  offer: "var(--green)",
  rejected: "var(--red)",
};

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

function statusIndex(s: string): number {
  const i = (APPLICATION_STATUSES as readonly string[]).indexOf(s);
  return i < 0 ? 0 : i;
}

function DetailSkeleton() {
  return (
    <main className="max-w-[1440px] mx-auto px-8 py-8 animate-pulse">
      <div className="h-3 w-24 bg-ed-surface rounded-ed-sm mb-6" />
      <div className="space-y-3 mb-8">
        <div className="h-9 w-2/3 bg-ed-surface rounded-ed-sm" />
        <div className="h-4 w-1/2 bg-ed-surface rounded-ed-sm" />
        <div className="flex gap-2 pt-2">
          <div className="h-5 w-20 bg-ed-surface rounded-ed-sm" />
          <div className="h-5 w-20 bg-ed-surface rounded-ed-sm" />
        </div>
      </div>
    </main>
  );
}

export default function JobDetail() {
  const params = useParams();
  const id = params.id as string;
  const { push } = useToast();

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
          return data.resume_scores.reduce((a, b) =>
            a.score > b.score ? a : b,
          ).resume_id;
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
      applied_at:
        previousApp?.applied_at ??
        (status === "applied" ? new Date().toISOString() : null),
      updated_at: new Date().toISOString(),
    };
    setJob({ ...job, application: optimistic });

    try {
      await updateJobStatus(job.id, { status });
      push(`status → ${status.replace(/_/g, " ")}`);
    } catch (e) {
      console.error("failed to update status:", e);
      setJob((j) => (j ? { ...j, application: previousApp } : j));
      push("failed to update status", "error");
    }
  };

  const handleNotesSave = async () => {
    if (!job) return;
    setSavingNotes(true);
    try {
      await updateJobStatus(job.id, { notes });
      push("notes saved");
    } catch (e) {
      console.error("failed to save notes:", e);
      push("failed to save notes", "error");
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
      push("tailored ✓");
      await loadJob();
    } catch (e) {
      console.error("failed to tailor:", e);
      push("tailor failed", "error");
    } finally {
      setTailoring(false);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !job) {
    return (
      <main className="max-w-[1440px] mx-auto px-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ed-muted hover:text-ed-text mb-6"
        >
          <Icon name="arrow-left" />
          back to jobs
        </Link>
        <div className="bg-ed-tint-red border border-ed-red text-ed-red rounded-ed-md p-4 text-[13px]">
          {error || "job not found"}
        </div>
      </main>
    );
  }

  const salary = fmtSalary(job.min_salary, job.max_salary);
  const currentStatus = job.application?.status || "saved";
  const currentIdx = statusIndex(currentStatus);
  const scores = job.resume_scores || [];
  const bestScore =
    scores.length > 0
      ? scores.reduce((a, b) => (a.score > b.score ? a : b))
      : null;
  const focusScore =
    scores.find((s) => s.resume_id === selectedResumeId) ?? bestScore;

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ed-muted hover:text-ed-text mb-6"
      >
        <Icon name="arrow-left" />
        back to jobs
      </Link>

      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 pb-8 border-b border-ed-rule items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge>{job.site.replace(/_/g, " ")}</Badge>
            {job.is_remote && <Badge variant="accent">remote</Badge>}
            {job.job_type && <Badge>{job.job_type.toLowerCase()}</Badge>}
          </div>
          <h1 className="font-display italic font-bold text-[56px] tracking-[-0.035em] m-0 leading-[1.05] text-ed-text">
            {job.title}
          </h1>
          <p className="font-body text-[15px] text-ed-muted mt-2 mb-0">
            <strong className="text-ed-text font-semibold">{job.company}</strong>
            {job.location ? ` · ${job.location}` : ""}
          </p>
          {salary && (
            <p className="font-mono text-[12px] text-ed-green mt-2 tracking-[0.04em]">
              {salary}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-5">
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-ed-md bg-ed-accent text-ed-on-accent font-body text-[13px] font-semibold hover:bg-ed-accent-glow transition-colors duration-ed-fast"
            >
              apply on {job.site.replace(/_/g, " ")}
              <Icon name="external" />
            </a>
            <button
              onClick={handleTailor}
              disabled={tailoring || !selectedResumeId}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-ed-md font-body text-[13px] font-medium bg-ed-surface text-ed-text border border-ed-border hover:bg-ed-surface-2 hover:border-ed-border-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-ed-fast"
            >
              <Icon name="wand" />
              {tailoring ? "tailoring…" : "tailor resume"}
            </button>
            {resumes.length > 0 && (
              <select
                aria-label="Select resume to tailor"
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="appearance-none bg-ed-inset border border-ed-border rounded-ed-md px-3 pr-7 py-2 text-[13px] text-ed-text font-body focus:outline-none focus:border-ed-accent transition-colors duration-ed-fast"
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label.toLowerCase()}
                  </option>
                ))}
              </select>
            )}
            <a
              href={resumeDownloadUrl(job.id, selectedResumeId || undefined)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-ed-md font-body text-[13px] font-medium text-ed-muted hover:text-ed-text border border-transparent hover:border-ed-border transition-colors duration-ed-fast"
            >
              download .docx
            </a>
          </div>
        </div>

        {focusScore && (
          <div className="flex flex-col items-center gap-2">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ed-muted">
              match score
            </div>
            <ScoreRing score={focusScore.score} size={104} stroke={6} />
            <div className="font-mono text-[10px] text-ed-muted tracking-[0.08em]">
              vs. {focusScore.label.toLowerCase()}
            </div>
          </div>
        )}
      </section>

      {/* Tailored banner */}
      {tailorResult && (
        <section className="mt-6 p-4 bg-ed-accent-15 border border-ed-accent-30 rounded-ed-md">
          <p className="font-body text-[13px] text-ed-accent font-semibold mb-1">
            resume tailored ({tailorResult.label})
          </p>
          <p className="font-body text-[13px] text-ed-text mb-1">
            {tailorResult.summary}
          </p>
          <p className="font-mono text-[10px] text-ed-muted tracking-[0.04em]">
            saved to: {tailorResult.file_path}
          </p>
        </section>
      )}

      {/* Body grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 mt-8">
        <div className="min-w-0">
          {scores.length > 0 && (
            <section className="pb-8 border-b border-ed-rule">
              <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ed-muted mb-4">
                score breakdown
              </h2>
              <div
                className="grid gap-3 mb-6"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(scores.length, 3)}, minmax(0, 1fr))`,
                }}
              >
                {scores.map((rs) => {
                  const selected = rs.resume_id === selectedResumeId;
                  return (
                    <button
                      key={rs.resume_id}
                      onClick={() => setSelectedResumeId(rs.resume_id)}
                      className={`text-left p-3 rounded-ed-md border transition-colors duration-ed-fast ${
                        selected
                          ? "bg-ed-accent-15 border-ed-accent-30"
                          : "bg-ed-surface border-ed-border hover:border-ed-border-2"
                      }`}
                    >
                      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ed-muted mb-1">
                        {rs.label.toLowerCase()}
                      </div>
                      <div className="font-display italic font-semibold text-[28px] tracking-[-0.03em] text-ed-text leading-none">
                        {Math.round(rs.score)}
                        <span className="font-mono not-italic text-[12px] text-ed-muted ml-1">
                          %
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {focusScore && focusScore.matched_keywords.length > 0 && (
                <div className="mb-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ed-muted mb-2">
                    matched ({focusScore.matched_keywords.length}) —{" "}
                    {focusScore.label.toLowerCase()}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {focusScore.matched_keywords.map((kw) => (
                      <Kw key={`m-${kw}`} variant="matched">
                        {kw}
                      </Kw>
                    ))}
                  </div>
                </div>
              )}

              {focusScore && focusScore.missing_keywords.length > 0 && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ed-muted mb-2">
                    missing ({focusScore.missing_keywords.length}) —{" "}
                    {focusScore.label.toLowerCase()}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {focusScore.missing_keywords.map((kw) => (
                      <Kw key={`x-${kw}`} variant="missing">
                        {kw}
                      </Kw>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {job.description && (
            <section className="pt-8">
              <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ed-muted mb-4">
                description
              </h2>
              <div
                tabIndex={0}
                role="region"
                aria-label="Job description"
                className="max-h-[540px] overflow-y-auto pr-2 prose prose-invert prose-sm max-w-none font-body [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h1]:italic [&_h2]:italic [&_h3]:italic [&_h1]:text-[20px] [&_h2]:text-[16px] [&_h3]:text-[14px] [&_p]:text-ed-text [&_li]:text-ed-text [&_strong]:text-ed-text [&_a]:text-ed-accent"
              >
                <ReactMarkdown>{job.description}</ReactMarkdown>
              </div>
            </section>
          )}
        </div>

        <aside className="min-w-0">
          <section className="pb-8 border-b border-ed-rule">
            <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ed-muted mb-4">
              application status
            </h2>
            <div className="flex flex-col gap-1">
              {APPLICATION_STATUSES.map((status, i) => {
                const isCurrent = status === currentStatus;
                const isDone = i < currentIdx;
                const pipBg = isCurrent
                  ? STATUS_PIP[status]
                  : isDone
                    ? "var(--accent-dim)"
                    : "var(--border-2)";
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-ed-md border text-left transition-colors duration-ed-fast text-[13px] ${
                      isCurrent
                        ? "bg-ed-accent-15 text-ed-accent border-ed-accent-30 font-semibold"
                        : isDone
                          ? "text-ed-muted border-transparent hover:bg-ed-surface"
                          : "text-ed-muted border-transparent hover:bg-ed-surface"
                    }`}
                  >
                    <span
                      className="w-[7px] h-[7px] rounded-full shrink-0"
                      style={{ background: pipBg }}
                      aria-hidden
                    />
                    <span className="font-body">
                      {status.replace(/_/g, " ")}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="py-8 border-b border-ed-rule">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ed-muted">
                notes
              </h2>
              {savingNotes && (
                <span className="font-mono text-[10px] text-ed-muted">
                  saving…
                </span>
              )}
            </div>
            <textarea
              aria-label="Application notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesSave}
              rows={6}
              placeholder="add notes about this application…"
              className="w-full bg-ed-inset border border-ed-border rounded-ed-md px-3 py-2 text-[13px] text-ed-text placeholder:text-ed-dim font-body focus:outline-none focus:border-ed-accent transition-colors duration-ed-fast resize-none"
            />
          </section>

          <section className="pt-8">
            <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ed-muted mb-4">
              details
            </h2>
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ed-muted mb-0.5">
                  source
                </dt>
                <dd className="text-ed-text">{job.site}</dd>
              </div>
              {job.job_type && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ed-muted mb-0.5">
                    type
                  </dt>
                  <dd className="text-ed-text">{job.job_type}</dd>
                </div>
              )}
              {job.date_posted && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ed-muted mb-0.5">
                    posted
                  </dt>
                  <dd className="text-ed-text">
                    {fmtRelative(job.date_posted)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ed-muted mb-0.5">
                  fetched
                </dt>
                <dd className="text-ed-text">{fmtRelative(job.date_fetched)}</dd>
              </div>
              {job.application?.applied_at && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ed-muted mb-0.5">
                    applied
                  </dt>
                  <dd className="text-ed-text">
                    {fmtRelative(job.application.applied_at)}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
