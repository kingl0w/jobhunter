import {
  Job,
  Quota,
  Resume,
  SearchTerm,
  SyncStatus,
  TailorResponse,
  User,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
  });
  if (res.status === 401) {
    const body = await res.text().catch(() => "");
    throw new AuthError(body || "unauthorized");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function login(app_password: string, username: string): Promise<{ user: User }> {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_password, username }),
  });
}

export function logout(): Promise<{ status: string }> {
  return request("/auth/logout", { method: "POST" });
}

export function whoami(): Promise<User> {
  return request("/auth/me");
}

export function getQuota(): Promise<Quota> {
  return request("/auth/quota");
}

export function fetchJobs(): Promise<Job[]> {
  return request("/jobs?limit=500");
}

export function fetchJob(id: string): Promise<Job> {
  return request(`/jobs/${id}`);
}

export function triggerSync(): Promise<{ status: string }> {
  return request("/sync", { method: "POST" });
}

export function fetchSyncStatus(): Promise<SyncStatus> {
  return request("/sync/status");
}

export function tailorResume(
  jobId: string,
  resumeId: string
): Promise<TailorResponse> {
  return request(
    `/jobs/${jobId}/tailor?resume_id=${encodeURIComponent(resumeId)}`,
    { method: "POST" }
  );
}

export function updateJobStatus(
  jobId: string,
  body: { status?: string; notes?: string }
): Promise<void> {
  return request(`/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function resumeDownloadUrl(jobId: string, resumeId?: string): string {
  const q = resumeId ? `?resume_id=${encodeURIComponent(resumeId)}` : "";
  return `${BASE}/jobs/${jobId}/resume${q}`;
}

export function getResumes(): Promise<Resume[]> {
  return request("/resumes");
}

export function uploadResume(file: File, label: string): Promise<Resume> {
  const form = new FormData();
  form.append("file", file);
  form.append("label", label);
  return request("/resumes", { method: "POST", body: form });
}

export function deleteResume(id: string): Promise<{ status: string }> {
  return request(`/resumes/${id}`, { method: "DELETE" });
}

export function getSearchTerms(): Promise<SearchTerm[]> {
  return request("/search-terms");
}

export function addSearchTerm(term: string): Promise<SearchTerm> {
  return request("/search-terms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ term }),
  });
}

export function deleteSearchTerm(id: number): Promise<{ status: string }> {
  return request(`/search-terms/${id}`, { method: "DELETE" });
}

export function toggleSearchTerm(
  id: number,
  is_active: boolean
): Promise<SearchTerm> {
  return request(`/search-terms/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active }),
  });
}
