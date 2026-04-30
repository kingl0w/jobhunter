"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJobs, updateJobStatus } from "../api";
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  Job,
} from "../types";
import ScoreRing from "../components/score-ring";
import { useSync } from "../components/sync-context";
import { useToast } from "../components/toast";

const COLS = APPLICATION_STATUSES;

const STATUS_PIP: Record<string, string> = {
  saved: "var(--muted)",
  applied: "var(--accent)",
  phone_screen: "var(--yellow)",
  interview: "var(--orange)",
  offer: "var(--green)",
  rejected: "var(--red)",
};

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

export default function PipelinePage() {
  const { push } = useToast();
  const { runId } = useSync();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setJobs(await fetchJobs());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, runId]);

  const grouped = useMemo<Record<string, Job[]>>(() => {
    const g: Record<string, Job[]> = Object.fromEntries(
      COLS.map((c) => [c, [] as Job[]]),
    );
    jobs.forEach((j) => {
      const s =
        (j.application?.status as ApplicationStatus | undefined) || "saved";
      if (g[s]) g[s].push(j);
    });
    Object.keys(g).forEach((k) => {
      g[k].sort((a, b) => {
        const ta = new Date(
          a.application?.updated_at || a.date_fetched,
        ).getTime();
        const tb = new Date(
          b.application?.updated_at || b.date_fetched,
        ).getTime();
        return tb - ta;
      });
    });
    return g;
  }, [jobs]);

  const counts: Record<string, number> = Object.fromEntries(
    Object.entries(grouped).map(([k, v]) => [k, v.length]),
  );

  const onDrop = async (col: ApplicationStatus) => {
    const id = draggingId;
    setDraggingId(null);
    setDropCol(null);
    if (!id) return;
    const target = jobs.find((j) => j.id === id);
    if (!target) return;
    if ((target.application?.status || "saved") === col) return;

    const prev = jobs;
    setJobs((js) =>
      js.map((j) =>
        j.id === id
          ? {
              ...j,
              application: {
                job_id: j.id,
                status: col,
                resume_used: j.application?.resume_used ?? null,
                notes: j.application?.notes ?? null,
                applied_at:
                  j.application?.applied_at ??
                  (col === "applied" ? new Date().toISOString() : null),
                updated_at: new Date().toISOString(),
              },
            }
          : j,
      ),
    );
    try {
      await updateJobStatus(id, { status: col });
      push(`status → ${col.replace(/_/g, " ")}`);
    } catch {
      setJobs(prev);
      push("failed to update status", "error");
    }
  };

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-8 w-full">
      <header className="mb-8 pb-4 border-b border-ed-rule">
        <h1 className="font-display italic font-bold text-[44px] tracking-[-0.035em] m-0 mb-1.5 text-ed-text leading-none">
          Pipeline
        </h1>
        <p className="font-mono text-[11px] text-ed-muted m-0 tracking-[0.04em]">
          drag jobs between columns to update status · {jobs.length} jobs
          tracked
        </p>
      </header>

      {error && (
        <div className="bg-ed-tint-red border border-ed-red text-ed-red rounded-ed-md p-3 mb-6 text-[13px]">
          {error}
        </div>
      )}

      {/* Funnel strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 border-y border-ed-rule mb-6">
        {COLS.map((col) => (
          <div
            key={`funnel-${col}`}
            className="flex flex-col items-start gap-1 px-4 py-4 border-r border-ed-rule last:border-r-0"
          >
            <div
              className={`font-display italic font-semibold text-[32px] tracking-[-0.03em] leading-none ${
                counts[col] > 0 ? "text-ed-accent" : "text-ed-dim"
              }`}
            >
              {counts[col]}
            </div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ed-muted">
              {col.replace(/_/g, " ")}
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="font-mono text-[11px] text-ed-muted">loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 border-t border-l border-ed-rule">
          {COLS.map((col) => (
            <div
              key={col}
              onDragOver={(e) => {
                e.preventDefault();
                setDropCol(col);
              }}
              onDragLeave={() =>
                setDropCol((c) => (c === col ? null : c))
              }
              onDrop={() => onDrop(col)}
              className={`border-r border-b border-ed-rule min-h-[320px] flex flex-col ${
                dropCol === col ? "bg-ed-accent-15" : ""
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-dashed border-ed-border">
                <h3 className="font-display italic font-semibold text-[16px] tracking-[-0.02em] m-0 flex items-center gap-2.5">
                  <span
                    className="w-[7px] h-[7px] rounded-full"
                    style={{ background: STATUS_PIP[col] }}
                    aria-hidden
                  />
                  {col.replace(/_/g, " ")}
                </h3>
                <span className="font-mono text-[11px] text-ed-muted">
                  {counts[col]}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-2.5 flex-1">
                {grouped[col].length === 0 ? (
                  <div className="font-mono text-[10px] text-ed-dim p-4 text-center border border-dashed border-ed-border rounded-ed-md uppercase tracking-[0.18em]">
                    no jobs
                  </div>
                ) : (
                  grouped[col].map((j) => {
                    const best = (j.resume_scores || []).reduce<
                      Job["resume_scores"][number] | null
                    >((a, b) => (!a || b.score > a.score ? b : a), null);
                    return (
                      <Link
                        href={`/jobs/${j.id}`}
                        key={j.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(j.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropCol(null);
                        }}
                        className={`bg-ed-surface border border-ed-border rounded-ed-md p-3 flex flex-col gap-1.5 cursor-grab transition-colors duration-ed-fast hover:border-ed-rule hover:bg-ed-surface-2 ${
                          draggingId === j.id ? "opacity-40" : ""
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-display italic font-semibold text-[14px] tracking-[-0.02em] m-0 leading-tight text-ed-text">
                            {j.title}
                          </h4>
                          {best && (
                            <ScoreRing
                              score={best.score}
                              size={32}
                              stroke={3}
                              showLabel={false}
                            />
                          )}
                        </div>
                        <p className="font-body text-[12px] text-ed-muted m-0">
                          {j.company}
                          {j.location ? ` · ${j.location}` : ""}
                        </p>
                        <div className="flex items-center justify-between gap-1.5 mt-1 font-mono text-[10px] text-ed-muted tracking-[0.05em]">
                          <span>
                            {j.site.replace(/_/g, " ")}
                            {j.is_remote ? " · remote" : ""}
                          </span>
                          <span>
                            {fmtRelative(
                              j.application?.updated_at || j.date_fetched,
                            )}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
