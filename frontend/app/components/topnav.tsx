"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSyncStatus, triggerSync } from "../api";
import type { SyncStatus } from "../types";
import Icon from "./icon-svg";

function fmtRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Topnav() {
  const pathname = usePathname();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await fetchSyncStatus();
        setStatus(s);
        if (s.status !== "running") stopPoll();
      } catch {
        stopPoll();
      }
    }, 3000);
  }, [stopPoll]);

  useEffect(() => {
    let cancelled = false;
    fetchSyncStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (s.status === "running") startPoll();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stopPoll();
    };
  }, [startPoll, stopPoll]);

  const onSync = async () => {
    if (status?.status === "running") return;
    try {
      await triggerSync();
      const s = await fetchSyncStatus();
      setStatus(s);
      startPoll();
    } catch {
      // swallow — keep masthead non-fatal
    }
  };

  const running = status?.status === "running";
  const errored = status?.status === "error";
  const dotState = running ? "running" : errored ? "error" : "idle";
  const dotColor = running
    ? "bg-ed-accent"
    : errored
    ? "bg-ed-red"
    : "bg-ed-green";
  const lastSyncLabel = running
    ? "syncing…"
    : `last sync ${fmtRelative(status?.finished_at ?? null)}`;

  const isJobs = pathname === "/" || pathname.startsWith("/jobs");
  const isPipeline = pathname.startsWith("/pipeline");
  const isSettings = pathname.startsWith("/settings");

  const tabClass = (active: boolean) =>
    `px-[18px] py-2 font-display italic text-[14px] font-semibold tracking-tight transition-colors duration-ed-fast border-b-2 -mb-px inline-flex items-center gap-2 ${
      active
        ? "text-ed-text border-ed-accent"
        : "text-ed-muted border-transparent hover:text-ed-text"
    }`;

  return (
    <header className="sticky top-0 z-50 bg-ed-bg border-b border-ed-rule">
      <div className="max-w-[1440px] mx-auto h-16 px-8 flex items-center gap-7">
        <div className="flex items-baseline gap-2.5">
          <span
            className="font-display italic font-bold text-[26px] tracking-[-0.04em] text-ed-text"
            style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1' }}
          >
            job<span className="text-ed-accent italic px-px">&amp;</span>hunt
          </span>
          <span className="font-mono text-[9px] font-medium text-ed-muted tracking-[0.18em] uppercase pl-3 ml-1 border-l border-ed-rule">
            a field guide · vol. 04
          </span>
        </div>

        <nav className="flex items-center" aria-label="Primary">
          <Link href="/" className={tabClass(isJobs)} aria-current={isJobs ? "page" : undefined}>
            Jobs
          </Link>
          <Link href="/pipeline" className={tabClass(isPipeline)} aria-current={isPipeline ? "page" : undefined}>
            Pipeline
          </Link>
          <Link href="/settings" className={tabClass(isSettings)} aria-current={isSettings ? "page" : undefined}>
            Settings
          </Link>
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2 font-mono text-[10px] text-ed-muted uppercase tracking-[0.12em]"
            data-state={dotState}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${dotColor} ${running ? "animate-pulse" : ""}`}
            />
            {lastSyncLabel}
          </div>
          <button
            onClick={onSync}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-ed-md bg-ed-surface text-ed-text border border-ed-border text-[12px] font-medium hover:bg-ed-surface-2 hover:border-ed-border-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-ed-fast"
          >
            <Icon name="refresh" />
            {running ? "syncing" : "sync"}
          </button>
        </div>
      </div>
    </header>
  );
}
