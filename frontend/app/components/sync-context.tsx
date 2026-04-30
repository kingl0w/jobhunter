"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchSyncStatus, triggerSync as apiTrigger } from "../api";
import type { SyncStatus } from "../types";
import { useAuth } from "./auth-context";

interface SyncState {
  status: SyncStatus | null;
  runId: number;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [runId, setRunId] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRef = useRef<string>("");

  const handleStatus = useCallback((s: SyncStatus) => {
    setStatus(s);
    if (prevRef.current === "running" && s.status !== "running") {
      setRunId((n) => n + 1);
    }
    prevRef.current = s.status;
  }, []);

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
        handleStatus(s);
        if (s.status !== "running") stopPoll();
      } catch {
        stopPoll();
      }
    }, 3000);
  }, [handleStatus, stopPoll]);

  useEffect(() => {
    if (!user) {
      setStatus(null);
      prevRef.current = "";
      stopPoll();
      return;
    }
    let cancelled = false;
    fetchSyncStatus()
      .then((s) => {
        if (cancelled) return;
        handleStatus(s);
        if (s.status === "running") startPoll();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stopPoll();
    };
  }, [user, handleStatus, startPoll, stopPoll]);

  const triggerSync = useCallback(async () => {
    await apiTrigger();
    const s = await fetchSyncStatus();
    handleStatus(s);
    startPoll();
  }, [handleStatus, startPoll]);

  const value = useMemo(
    () => ({ status, runId, triggerSync }),
    [status, runId, triggerSync],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
