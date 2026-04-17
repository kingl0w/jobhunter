export interface ResumeScoreRead {
  job_id: string;
  resume_id: string;
  label: string;
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  date_scored: string;
}

export interface Resume {
  id: string;
  filename: string;
  label: string;
  uploaded_at: string;
}

export interface SearchTerm {
  id: number;
  term: string;
  is_active: boolean;
  created_at: string;
}

export interface ApplicationRead {
  job_id: string;
  status: string;
  resume_used: string | null;
  notes: string | null;
  applied_at: string | null;
  updated_at: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  company_url: string | null;
  job_url: string;
  site: string;
  description: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  is_remote: boolean;
  job_type: string | null;
  min_salary: number | null;
  max_salary: number | null;
  date_posted: string | null;
  date_fetched: string;
  is_active: boolean;
  resume_scores: ResumeScoreRead[];
  application: ApplicationRead | null;
}

export interface SyncStatus {
  status: string;
  started_at: string | null;
  finished_at: string | null;
  result: {
    total_fetched: number;
    new_jobs: number;
    dupes_skipped: number;
    stale_deactivated: number;
    scored: number;
  } | null;
  error: string | null;
}

export interface TailorResponse {
  file_path: string;
  resume_id: string;
  label: string;
  missing_keywords: string[];
  summary: string;
}

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
