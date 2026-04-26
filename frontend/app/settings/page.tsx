"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addSearchTerm,
  deleteResume,
  deleteSearchTerm,
  getResumes,
  getSearchTerms,
  toggleSearchTerm,
  uploadResume,
} from "../api";
import type { Resume, SearchTerm } from "../types";
import Icon from "../components/icon-svg";
import { useToast } from "../components/toast";

const ALLOWED_EXTS = [".docx", ".pdf"];
const EXAMPLES = [
  "software engineer",
  "python developer",
  "backend engineer",
  "devops engineer",
  "platform engineer",
  "site reliability engineer",
];

type Section = "resumes" | "terms" | "integrations";

interface IntegrationRow {
  id: string;
  name: string;
  description: string;
  status: "connected" | "warning" | "disconnected";
}

const INTEGRATIONS: IntegrationRow[] = [
  {
    id: "gemini",
    name: "Gemini",
    description: "resume tailoring · gemini-2.5-flash",
    status: "connected",
  },
  {
    id: "indeed",
    name: "Indeed",
    description: "job board scraping · python-jobspy",
    status: "connected",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "job board scraping · python-jobspy",
    status: "connected",
  },
  {
    id: "ziprecruiter",
    name: "ZipRecruiter",
    description: "marked flaky · disabled in fetcher",
    status: "warning",
  },
  {
    id: "google",
    name: "Google Jobs",
    description: "marked flaky · disabled in fetcher",
    status: "warning",
  },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export default function SettingsPage() {
  const { push } = useToast();
  const [section, setSection] = useState<Section>("resumes");

  const [resumes, setResumes] = useState<Resume[]>([]);
  const [terms, setTerms] = useState<SearchTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [newTerm, setNewTerm] = useState("");
  const [addingTerm, setAddingTerm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([getResumes(), getSearchTerms()]);
      setResumes(r);
      setTerms(t);
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

  const handleFile = (file: File | null) => {
    setUploadFile(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadLabel.trim()) return;

    const name = uploadFile.name.toLowerCase();
    if (!ALLOWED_EXTS.some((ext) => name.endsWith(ext))) {
      setError("only .docx and .pdf files are allowed");
      push("only .docx and .pdf allowed", "error");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await uploadResume(uploadFile, uploadLabel.trim());
      setUploadLabel("");
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      push("resume uploaded");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
      push("upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResume = async (resume: Resume) => {
    if (!confirm(`delete resume "${resume.label}"?`)) return;
    try {
      await deleteResume(resume.id);
      push("resume deleted");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
      push("delete failed", "error");
    }
  };

  const handleAddTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTerm.trim();
    if (!trimmed) return;
    setAddingTerm(true);
    setError(null);
    try {
      await addSearchTerm(trimmed);
      setNewTerm("");
      push("term added");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "add term failed");
      push("add term failed", "error");
    } finally {
      setAddingTerm(false);
    }
  };

  const handleToggleTerm = async (term: SearchTerm) => {
    const previous = terms;
    setTerms((ts) =>
      ts.map((t) =>
        t.id === term.id ? { ...t, is_active: !t.is_active } : t,
      ),
    );
    try {
      await toggleSearchTerm(term.id, !term.is_active);
    } catch (e) {
      setTerms(previous);
      setError(e instanceof Error ? e.message : "toggle failed");
      push("toggle failed", "error");
    }
  };

  const handleDeleteTerm = async (term: SearchTerm) => {
    if (!confirm(`delete search term "${term.term}"?`)) return;
    try {
      await deleteSearchTerm(term.id);
      push("term deleted");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
      push("delete failed", "error");
    }
  };

  const applyExampleTerm = (example: string) => {
    setNewTerm(example);
  };

  const navItem = (s: Section, label: string, count?: number) => {
    const active = section === s;
    const iconName: "briefcase" | "search" | "settings" =
      s === "resumes" ? "briefcase" : s === "terms" ? "search" : "settings";
    return (
      <button
        type="button"
        onClick={() => setSection(s)}
        aria-current={active ? "page" : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-ed-md text-left transition-colors duration-ed-fast ${
          active
            ? "bg-ed-accent-15 text-ed-accent"
            : "text-ed-muted hover:bg-ed-surface hover:text-ed-text"
        }`}
      >
        <Icon name={iconName} />
        <span className="font-body text-[13px] flex-1">{label}</span>
        {typeof count === "number" && (
          <span className="font-mono text-[10px] text-ed-muted tracking-[0.04em]">
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <main className="max-w-[1440px] mx-auto px-8 py-8 w-full">
      <header className="mb-8 pb-4 border-b border-ed-rule">
        <h1 className="font-display italic font-bold text-[44px] tracking-[-0.035em] m-0 mb-1.5 text-ed-text leading-none">
          Settings
        </h1>
        <p className="font-mono text-[11px] text-ed-muted m-0 tracking-[0.04em]">
          manage resumes, search terms, and integrations
        </p>
      </header>

      {error && (
        <div className="bg-ed-tint-red border border-ed-red text-ed-red rounded-ed-md p-3 mb-6 text-[13px]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
        <nav
          className="md:sticky md:top-24 md:self-start flex flex-col gap-1"
          aria-label="Settings sections"
        >
          {navItem("resumes", "resumes", resumes.length)}
          {navItem("terms", "search terms", terms.length)}
          {navItem("integrations", "integrations", INTEGRATIONS.length)}
        </nav>

        <div className="min-w-0">
          {section === "resumes" && (
            <section>
              <div className="mb-6">
                <h2 className="font-display italic font-semibold text-[24px] tracking-[-0.025em] text-ed-text m-0 mb-1">
                  resumes
                </h2>
                <p className="font-mono text-[11px] text-ed-muted m-0 tracking-[0.04em]">
                  uploading a resume triggers automatic rescoring of all jobs
                </p>
              </div>

              <form
                onSubmit={handleUpload}
                className="mb-6 p-5 bg-ed-surface border border-ed-border rounded-ed-md space-y-4"
              >
                <div>
                  <label className="block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ed-muted mb-1.5">
                    label
                  </label>
                  <input
                    type="text"
                    value={uploadLabel}
                    onChange={(e) => setUploadLabel(e.target.value)}
                    placeholder="e.g. Backend Engineer"
                    className="w-full bg-ed-inset border border-ed-border rounded-ed-md px-3 py-2 text-[13px] text-ed-text placeholder:text-ed-dim font-body focus:outline-none focus:border-ed-accent transition-colors duration-ed-fast"
                    required
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ed-muted mb-1.5">
                    file (.docx, .pdf)
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleFile(f);
                    }}
                    className={`flex flex-col items-center gap-2 px-4 py-8 rounded-ed-md border-2 border-dashed transition-colors duration-ed-fast ${
                      dragActive
                        ? "border-ed-accent bg-ed-accent-15"
                        : "border-ed-border bg-ed-inset"
                    }`}
                  >
                    <Icon name="upload" size={20} />
                    <p className="font-mono text-[11px] text-ed-muted tracking-[0.04em]">
                      {uploadFile
                        ? uploadFile.name
                        : "drop a file here or browse"}
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".docx,.pdf"
                      onChange={(e) =>
                        handleFile(e.target.files?.[0] ?? null)
                      }
                      className="block w-full text-[12px] text-ed-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-ed-sm file:border-0 file:bg-ed-surface-2 file:text-ed-text file:font-mono file:text-[10px] file:uppercase file:tracking-[0.14em] hover:file:bg-ed-border file:cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading || !uploadFile || !uploadLabel.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-ed-md bg-ed-accent text-ed-on-accent font-body text-[13px] font-semibold hover:bg-ed-accent-glow disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-ed-fast"
                >
                  <Icon name="upload" />
                  {uploading ? "uploading…" : "upload resume"}
                </button>
              </form>

              {loading ? (
                <div className="font-mono text-[11px] text-ed-muted">
                  loading…
                </div>
              ) : resumes.length === 0 ? (
                <div className="border border-dashed border-ed-border rounded-ed-md p-10 text-center">
                  <p className="font-display italic text-[18px] text-ed-text mb-1">
                    no resumes yet
                  </p>
                  <p className="font-mono text-[11px] text-ed-muted tracking-[0.04em]">
                    upload at least one resume to start matching jobs
                  </p>
                </div>
              ) : (
                <ul className="border-t border-l border-ed-rule">
                  {resumes.map((resume) => (
                    <li
                      key={resume.id}
                      className="flex items-center gap-4 p-4 border-r border-b border-ed-rule"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-display italic font-semibold text-[16px] text-ed-text">
                          {resume.label}
                        </div>
                        <div className="font-mono text-[10px] text-ed-muted tracking-[0.04em] truncate">
                          {resume.filename} · uploaded{" "}
                          {formatDate(resume.uploaded_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteResume(resume)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ed-md font-mono text-[10px] uppercase tracking-[0.14em] text-ed-muted hover:text-ed-red border border-transparent hover:border-ed-red/40 transition-colors duration-ed-fast"
                        aria-label={`Delete resume ${resume.label}`}
                      >
                        <Icon name="trash" />
                        delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {section === "terms" && (
            <section>
              <div className="mb-6">
                <h2 className="font-display italic font-semibold text-[24px] tracking-[-0.025em] text-ed-text m-0 mb-1">
                  search terms
                </h2>
                <p className="font-mono text-[11px] text-ed-muted m-0 tracking-[0.04em]">
                  terms used when fetching jobs from job boards
                </p>
              </div>

              <form
                onSubmit={handleAddTerm}
                className="flex gap-2 mb-6 p-4 bg-ed-surface border border-ed-border rounded-ed-md"
              >
                <input
                  type="text"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder="add a search term…"
                  className="flex-1 bg-ed-inset border border-ed-border rounded-ed-md px-3 py-2 text-[13px] text-ed-text placeholder:text-ed-dim font-body focus:outline-none focus:border-ed-accent transition-colors duration-ed-fast"
                />
                <button
                  type="submit"
                  disabled={addingTerm || !newTerm.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-ed-md bg-ed-accent text-ed-on-accent font-body text-[13px] font-semibold hover:bg-ed-accent-glow disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-ed-fast"
                >
                  <Icon name="plus" />
                  {addingTerm ? "adding…" : "add"}
                </button>
              </form>

              {!loading && terms.length === 0 && (
                <div className="mb-6">
                  <p className="font-mono text-[11px] text-ed-muted tracking-[0.04em] mb-3">
                    no search terms yet — try one of these:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => applyExampleTerm(ex)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-ed font-mono text-[10px] uppercase tracking-[0.14em] text-ed-muted hover:text-ed-text border border-ed-border hover:border-ed-border-2 transition-colors duration-ed-fast"
                      >
                        <Icon name="plus" size={10} /> {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading ? (
                <div className="font-mono text-[11px] text-ed-muted">
                  loading…
                </div>
              ) : terms.length > 0 ? (
                <ul className="border-t border-l border-ed-rule">
                  {terms.map((term) => (
                    <li
                      key={term.id}
                      className="flex items-center gap-4 p-4 border-r border-b border-ed-rule"
                    >
                      <span
                        className={`flex-1 font-body text-[14px] ${
                          term.is_active
                            ? "text-ed-text"
                            : "text-ed-dim line-through"
                        }`}
                      >
                        {term.term}
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={term.is_active}
                          onChange={() => handleToggleTerm(term)}
                          className="w-3.5 h-3.5 accent-ed-accent"
                        />
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ed-muted">
                          {term.is_active ? "active" : "inactive"}
                        </span>
                      </label>
                      <button
                        onClick={() => handleDeleteTerm(term)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ed-md font-mono text-[10px] uppercase tracking-[0.14em] text-ed-muted hover:text-ed-red border border-transparent hover:border-ed-red/40 transition-colors duration-ed-fast"
                        aria-label={`Delete search term ${term.term}`}
                      >
                        <Icon name="trash" />
                        delete
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          )}

          {section === "integrations" && (
            <section>
              <div className="mb-6">
                <h2 className="font-display italic font-semibold text-[24px] tracking-[-0.025em] text-ed-text m-0 mb-1">
                  integrations
                </h2>
                <p className="font-mono text-[11px] text-ed-muted m-0 tracking-[0.04em]">
                  status of external services this app talks to
                </p>
              </div>

              <ul className="border-t border-l border-ed-rule">
                {INTEGRATIONS.map((row) => {
                  const dot =
                    row.status === "connected"
                      ? "var(--green)"
                      : row.status === "warning"
                        ? "var(--yellow)"
                        : "var(--red)";
                  const label =
                    row.status === "connected"
                      ? "connected"
                      : row.status === "warning"
                        ? "warning"
                        : "disconnected";
                  return (
                    <li
                      key={row.id}
                      className="flex items-center gap-4 p-4 border-r border-b border-ed-rule"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-display italic font-semibold text-[16px] text-ed-text">
                          {row.name}
                        </div>
                        <div className="font-mono text-[10px] text-ed-muted tracking-[0.04em] truncate">
                          {row.description}
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ed-muted"
                        data-state={row.status}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: dot }}
                          aria-hidden
                        />
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
