import hmac
import logging
import secrets
from datetime import datetime, timedelta

from fastapi import Cookie, Depends, HTTPException, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import LLMUsage, User

log = logging.getLogger(__name__)

USAGE_TAILOR = "tailor"
USAGE_SUMMARIZE = "summarize"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="jobhunter-session")


def issue_session_cookie(response: Response, user_id: str) -> None:
    token = _serializer().dumps({"uid": user_id})
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_days * 86400,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        samesite="lax",
        secure=settings.cookie_secure,
    )


def _decode_session(token: str | None) -> str | None:
    if not token:
        return None
    try:
        data = _serializer().loads(token, max_age=settings.session_max_age_days * 86400)
    except SignatureExpired:
        return None
    except BadSignature:
        return None
    if not isinstance(data, dict):
        return None
    return data.get("uid")


def verify_app_password(provided: str) -> bool:
    expected = settings.app_password or ""
    return hmac.compare_digest(provided.encode(), expected.encode())


def get_or_create_user(db: Session, username: str, *, is_demo: bool = False) -> User:
    username = username.strip()
    user = db.query(User).filter(User.username == username).first()
    if user:
        return user
    user = User(username=username, is_demo=is_demo)
    db.add(user)
    db.commit()
    db.refresh(user)
    log.info("created user %s (demo=%s)", username, is_demo)
    return user


def current_user(
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> User:
    user_id = _decode_session(session_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="not authenticated")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="user no longer exists")
    return user


def optional_user(
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> User | None:
    user_id = _decode_session(session_token)
    if not user_id:
        return None
    return db.get(User, user_id)


def _today_window() -> tuple[datetime, datetime]:
    now = datetime.utcnow()
    start = datetime(now.year, now.month, now.day)
    return start, start + timedelta(days=1)


def count_usage_today(db: Session, user_id: str, kind: str) -> int:
    start, end = _today_window()
    return (
        db.query(LLMUsage)
        .filter(
            LLMUsage.user_id == user_id,
            LLMUsage.kind == kind,
            LLMUsage.used_at >= start,
            LLMUsage.used_at < end,
        )
        .count()
    )


def record_usage(db: Session, user_id: str, kind: str) -> None:
    db.add(LLMUsage(user_id=user_id, kind=kind))
    db.commit()


def enforce_quota(db: Session, user: User, kind: str) -> None:
    if user.is_demo:
        raise HTTPException(status_code=403, detail="demo accounts cannot use AI features")
    limits = {
        USAGE_TAILOR: settings.daily_tailor_limit,
        USAGE_SUMMARIZE: settings.daily_summarize_limit,
    }
    limit = limits.get(kind)
    if limit is None or limit <= 0:
        return
    used = count_usage_today(db, user.id, kind)
    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"daily {kind} limit reached ({used}/{limit}); resets at 00:00 UTC",
        )


def random_session_secret() -> str:
    return secrets.token_urlsafe(48)
