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
    sync_interval_hours: int = 6
    max_results_per_source: int = 25
    hours_old: int = 72

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def model_post_init(self, __context) -> None:
        self.resumes_dir = _resolve(self.resumes_dir)
        self.uploads_dir = _resolve(self.uploads_dir)
        self.tailored_resumes_dir = _resolve(self.tailored_resumes_dir)
        self.db_path = _resolve(self.db_path)
        Path(self.resumes_dir).mkdir(parents=True, exist_ok=True)
        Path(self.uploads_dir).mkdir(parents=True, exist_ok=True)
        Path(self.tailored_resumes_dir).mkdir(parents=True, exist_ok=True)

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"


settings = Settings()
