"use client";

import Link from "next/link";
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
import { Resume, SearchTerm } from "../types";

const ALLOWED_EXTS = [".docx", ".pdf"];
const EXAMPLE_TERMS = [
  "software engineer",
  "python developer",
  "backend engineer",
  "devops engineer",
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export default function SettingsPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [terms, setTerms] = useState<SearchTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadLabel.trim()) return;

    const name = uploadFile.name.toLowerCase();
    if (!ALLOWED_EXTS.some((ext) => name.endsWith(ext))) {
      setError("Only .docx and .pdf files are allowed");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await uploadResume(uploadFile, uploadLabel.trim());
      setUploadLabel("");
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResume = async (resume: Resume) => {
    if (!confirm(`Delete resume "${resume.label}"?`)) return;
    try {
      await deleteResume(resume.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "add term failed");
    } finally {
      setAddingTerm(false);
    }
  };

  const handleToggleTerm = async (term: SearchTerm) => {
    const previous = terms;
    setTerms((ts) =>
      ts.map((t) => (t.id === term.id ? { ...t, is_active: !t.is_active } : t))
    );
    try {
      await toggleSearchTerm(term.id, !term.is_active);
    } catch (e) {
      setTerms(previous);
      setError(e instanceof Error ? e.message : "toggle failed");
    }
  };

  const handleDeleteTerm = async (term: SearchTerm) => {
    if (!confirm(`Delete search term "${term.term}"?`)) return;
    try {
      await deleteSearchTerm(term.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    }
  };

  const applyExampleTerm = (example: string) => {
    setNewTerm(example);
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-6">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link href="/" className="text-sm text-muted hover:text-primary">
          &larr; Back to jobs
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-2xl font-bold text-primary">Settings</h1>
        <p className="text-xs text-muted mt-1">
          Manage resumes and search terms
        </p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/*resumes section*/}
      <section className="mb-10 pb-8 border-b border-subtle">
        <h2 className="font-display text-lg font-semibold text-primary mb-1">
          Resumes
        </h2>
        <p className="text-xs text-muted mb-4">
          Uploading a resume triggers automatic rescoring of all jobs.
        </p>

        <form
          onSubmit={handleUpload}
          className="flex flex-wrap items-end gap-3 p-4 bg-surface-raised border border-subtle rounded mb-5"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-muted mb-1">Label</label>
            <input
              type="text"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              placeholder="e.g. Backend Engineer"
              className="w-full bg-surface border border-subtle rounded px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-strong"
              required
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-muted mb-1">
              File (.docx, .pdf)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-accent file:text-primary file:text-sm file:font-medium hover:file:opacity-90 file:cursor-pointer"
              required
            />
          </div>
          <button
            type="submit"
            disabled={uploading || !uploadFile || !uploadLabel.trim()}
            className="px-4 py-2 rounded bg-accent text-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>

        {loading ? (
          <div className="text-sm text-muted">Loading...</div>
        ) : resumes.length === 0 ? (
          <div className="py-8 text-center text-secondary">
            <p className="text-sm">Upload at least one resume to start matching jobs</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {resumes.map((resume) => (
              <li
                key={resume.id}
                className="flex items-center gap-4 p-3 bg-surface-raised border border-subtle rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary">
                    {resume.label}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {resume.filename} &middot; uploaded {formatDate(resume.uploaded_at)}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteResume(resume)}
                  className="text-xs px-3 py-1.5 rounded bg-surface text-red-200 hover:bg-red-500/20 border border-subtle transition-colors"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*search terms section*/}
      <section>
        <h2 className="font-display text-lg font-semibold text-primary mb-1">
          Search Terms
        </h2>
        <p className="text-xs text-muted mb-4">
          Terms used when fetching jobs from job boards.
        </p>

        <form
          onSubmit={handleAddTerm}
          className="flex gap-2 mb-5 p-4 bg-surface-raised border border-subtle rounded"
        >
          <input
            type="text"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            placeholder="Add a search term..."
            className="flex-1 bg-surface border border-subtle rounded px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-strong"
          />
          <button
            type="submit"
            disabled={addingTerm || !newTerm.trim()}
            className="px-4 py-2 rounded bg-accent text-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {addingTerm ? "Adding..." : "Add"}
          </button>
        </form>

        {loading ? (
          <div className="text-sm text-muted">Loading...</div>
        ) : terms.length === 0 ? (
          <div className="py-6 text-secondary">
            <p className="text-sm mb-3">No search terms yet. Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_TERMS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => applyExampleTerm(ex)}
                  className="text-xs px-3 py-1.5 rounded bg-surface-raised text-secondary hover:text-primary border border-subtle transition-colors"
                >
                  + {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {terms.map((term) => (
              <li
                key={term.id}
                className="flex items-center gap-4 p-3 bg-surface-raised border border-subtle rounded"
              >
                <span
                  className={`flex-1 text-sm ${term.is_active ? "text-primary" : "text-muted line-through"}`}
                >
                  {term.term}
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={term.is_active}
                    onChange={() => handleToggleTerm(term)}
                    className="w-4 h-4 rounded border-subtle bg-surface accent-accent"
                  />
                  <span className="text-xs text-secondary">
                    {term.is_active ? "active" : "inactive"}
                  </span>
                </label>
                <button
                  onClick={() => handleDeleteTerm(term)}
                  className="text-xs px-3 py-1.5 rounded bg-surface text-red-200 hover:bg-red-500/20 border border-subtle transition-colors"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
