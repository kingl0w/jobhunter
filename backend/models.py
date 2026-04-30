import hashlib
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, computed_field
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


def _new_uuid() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_new_uuid)
    username = Column(String, nullable=False, unique=True)
    is_demo = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="user", cascade="all, delete-orphan")
    llm_usage = relationship("LLMUsage", back_populates="user", cascade="all, delete-orphan")


class LLMUsage(Base):
    __tablename__ = "llm_usage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    kind = Column(String, nullable=False)
    used_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="llm_usage")

    __table_args__ = (
        Index("ix_llm_usage_user_used_at", "user_id", "used_at"),
    )


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    company_url = Column(String, nullable=True)
    job_url = Column(String, nullable=False)
    site = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    is_remote = Column(Boolean, default=False)
    job_type = Column(String, nullable=True)
    min_salary = Column(Integer, nullable=True)
    max_salary = Column(Integer, nullable=True)
    date_posted = Column(DateTime, nullable=True)
    date_fetched = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    resume_scores = relationship(
        "ResumeScore",
        back_populates="job",
        cascade="all, delete-orphan",
    )
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")

    @staticmethod
    def make_id(title: str, company: str, location: str | None) -> str:
        title = str(title or "").strip().lower()
        company = str(company or "").strip().lower()
        location = str(location or "").strip().lower()
        raw = f"{title}|{company}|{location}"
        return hashlib.sha256(raw.encode()).hexdigest()


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    label = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    extracted_text = Column(Text, nullable=False, default="")
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="resumes")
    resume_scores = relationship(
        "ResumeScore",
        back_populates="resume",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_resumes_user_id", "user_id"),)

    @staticmethod
    def make_id(user_id: str, filename: str) -> str:
        return hashlib.sha256(f"{user_id}|{filename}".encode()).hexdigest()


class ResumeScore(Base):
    __tablename__ = "resume_scores"

    job_id = Column(String, ForeignKey("jobs.id"), primary_key=True)
    resume_id = Column(String, ForeignKey("resumes.id"), primary_key=True)
    score = Column(Float, nullable=False)
    matched_keywords = Column(JSON, default=list)
    missing_keywords = Column(JSON, default=list)
    date_scored = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="resume_scores")
    resume = relationship("Resume", back_populates="resume_scores")

    @property
    def label(self) -> str:
        return self.resume.label if self.resume else ""


class SearchTerm(Base):
    __tablename__ = "search_terms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    term = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


APPLICATION_STATUSES = ("saved", "applied", "phone_screen", "interview", "offer", "rejected")


class Application(Base):
    __tablename__ = "applications"

    job_id = Column(String, ForeignKey("jobs.id"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    status = Column(String, nullable=False, default="saved")
    resume_used = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    applied_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="applications")
    user = relationship("User", back_populates="applications")


class JobBase(BaseModel):
    title: str
    company: str
    company_url: str | None = None
    job_url: str
    site: str
    description: str | None = None
    location: str | None = None
    city: str | None = None
    state: str | None = None
    is_remote: bool = False
    job_type: str | None = None
    min_salary: int | None = None
    max_salary: int | None = None
    date_posted: datetime | None = None


class JobCreate(JobBase):
    @computed_field
    @property
    def id(self) -> str:
        return Job.make_id(self.title, self.company, self.location)


class ResumeScoreRead(BaseModel):
    job_id: str
    resume_id: str
    label: str
    score: float
    matched_keywords: list[str] = []
    missing_keywords: list[str] = []
    date_scored: datetime

    model_config = {"from_attributes": True}


class JobRead(JobBase):
    id: str
    date_fetched: datetime
    is_active: bool
    resume_scores: list[ResumeScoreRead] = []
    application: Optional["ApplicationRead"] = None

    model_config = {"from_attributes": True}


class ResumeRead(BaseModel):
    id: str
    filename: str
    label: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class SearchTermRead(BaseModel):
    id: int
    term: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchTermCreate(BaseModel):
    term: str = Field(min_length=2, max_length=200)


class SearchTermUpdate(BaseModel):
    is_active: bool


class ApplicationBase(BaseModel):
    status: str = "saved"
    resume_used: str | None = None
    notes: str | None = None
    applied_at: datetime | None = None


class ApplicationCreate(ApplicationBase):
    job_id: str


class ApplicationUpdate(BaseModel):
    status: str | None = None
    resume_used: str | None = None
    notes: str | None = None
    applied_at: datetime | None = None


class ApplicationRead(ApplicationBase):
    job_id: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserRead(BaseModel):
    id: str
    username: str
    is_demo: bool

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    app_password: str
    username: str = Field(min_length=2, max_length=40, pattern=r"^[a-zA-Z0-9_-]+$")


class LoginResponse(BaseModel):
    user: UserRead
