"use client";

import { useEffect, useState } from "react";

export type ToastKind = "info" | "error";
export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  listeners.forEach((l) => l(toasts));
}

export function pushToast(text: string, kind: ToastKind = "info"): void {
  const id = nextId++;
  toasts = [...toasts, { id, text, kind }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 2800);
}

export function useToast() {
  return { push: pushToast };
}

export function ToastStack() {
  const [items, setItems] = useState<Toast[]>(toasts);
  useEffect(() => {
    const sub: Listener = (next) => setItems(next);
    listeners.add(sub);
    return () => {
      listeners.delete(sub);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="bg-ed-surface border border-ed-rule border-l-2 rounded-ed-md px-4 py-2.5 font-mono text-[11px] tracking-[0.04em] text-ed-text flex items-center gap-2.5 min-w-[260px] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{
            borderLeftColor:
              t.kind === "error" ? "var(--red)" : "var(--accent)",
            animation: "ed-toast-in 200ms ease-out",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: t.kind === "error" ? "var(--red)" : "var(--accent)",
            }}
          />
          <span>{t.text}</span>
        </div>
      ))}
      <style jsx>{`
        @keyframes ed-toast-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
