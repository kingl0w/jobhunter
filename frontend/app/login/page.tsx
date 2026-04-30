"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPublicConfig, login, loginAsDemo } from "../api";
import { useAuth } from "../components/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [appPassword, setAppPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);

  useEffect(() => {
    getPublicConfig()
      .then((c) => setDemoEnabled(c.demo_enabled))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(appPassword, username.trim());
      await refresh();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginAsDemo();
      await refresh();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "demo login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-[420px] mx-auto px-8 py-16 w-full">
      <header className="mb-8">
        <h1 className="font-display italic font-bold text-[44px] tracking-[-0.035em] m-0 mb-1.5 text-ed-text leading-none">
          sign in
        </h1>
        <p className="font-mono text-[11px] text-ed-muted m-0 tracking-[0.04em]">
          enter the shared app password and pick a username
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="p-5 bg-ed-surface border border-ed-border rounded-ed-md space-y-4"
      >
        <div>
          <label
            htmlFor="username"
            className="block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ed-muted mb-1.5"
          >
            username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. ian"
            autoComplete="username"
            required
            minLength={2}
            maxLength={40}
            pattern="[a-zA-Z0-9_-]+"
            className="w-full bg-ed-inset border border-ed-border rounded-ed-md px-3 py-2 text-[13px] text-ed-text placeholder:text-ed-dim font-body focus:outline-none focus:border-ed-accent transition-colors duration-ed-fast"
          />
        </div>

        <div>
          <label
            htmlFor="app-password"
            className="block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ed-muted mb-1.5"
          >
            app password
          </label>
          <input
            id="app-password"
            type="password"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full bg-ed-inset border border-ed-border rounded-ed-md px-3 py-2 text-[13px] text-ed-text placeholder:text-ed-dim font-body focus:outline-none focus:border-ed-accent transition-colors duration-ed-fast"
          />
        </div>

        {error && (
          <div className="bg-ed-tint-red border border-ed-red text-ed-red rounded-ed-md p-3 text-[12px]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !appPassword || !username.trim()}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-ed-md bg-ed-accent text-ed-on-accent font-body text-[13px] font-semibold hover:bg-ed-accent-glow disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-ed-fast"
        >
          {submitting ? "signing in…" : "sign in"}
        </button>

        {demoEnabled && (
          <button
            type="button"
            onClick={handleDemo}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-ed-md bg-ed-surface-2 text-ed-text border border-ed-border font-body text-[12px] hover:bg-ed-border transition-colors duration-ed-fast"
          >
            try the demo (read-only)
          </button>
        )}

        <p className="font-mono text-[10px] text-ed-muted tracking-[0.04em]">
          new username? a profile is created automatically on first sign-in.
        </p>
      </form>
    </main>
  );
}
