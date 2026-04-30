from pathlib import Path

from pydantic_settings import BaseSettings

PROJECT_ROOT = Path(__file__).parent.parent


def _resolve(path: str) -> str:
    p = Path(path)
    if not p.is_absolute():
        p = PROJECT_ROOT / p
    return str(p)


class Settings(BaseSettings):
    gemini_api_key: str = ""
    resumes_dir: str = "resumes"
    uploads_dir: str = "resumes/uploads"
    tailored_resumes_dir: str = "resumes/tailored"
    db_path: str = "data/jobs.db"
    backups_dir: str = "data/backups"
    sync_interval_hours: int = 6
    max_results_per_source: int = 25
    hours_old: int = 72

    app_password: str = "changeme"
    session_secret: str = "dev-secret-change-me"
    session_cookie_name: str = "jh_session"
    session_max_age_days: int = 30
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool = False

    daily_tailor_limit: int = 30
    daily_summarize_limit: int = 60

    log_dir: str = "data/logs"
    sentry_dsn: str = ""
    backup_keep_days: int = 14

    demo_mode: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    digest_hour_utc: int = 13

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def model_post_init(self, __context) -> None:
        self.resumes_dir = _resolve(self.resumes_dir)
        self.uploads_dir = _resolve(self.uploads_dir)
        self.tailored_resumes_dir = _resolve(self.tailored_resumes_dir)
        self.db_path = _resolve(self.db_path)
        self.backups_dir = _resolve(self.backups_dir)
        self.log_dir = _resolve(self.log_dir)
        Path(self.resumes_dir).mkdir(parents=True, exist_ok=True)
        Path(self.uploads_dir).mkdir(parents=True, exist_ok=True)
        Path(self.tailored_resumes_dir).mkdir(parents=True, exist_ok=True)
        Path(self.backups_dir).mkdir(parents=True, exist_ok=True)
        Path(self.log_dir).mkdir(parents=True, exist_ok=True)

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
