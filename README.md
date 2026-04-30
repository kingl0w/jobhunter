# jobhunter

Fetches remote job postings from multiple boards, scores them against your resumes via keyword and synonym matching, and generates tailored resumes for the best matches using Gemini. Multi-user, with shared-password sign-in. Built with FastAPI and Next.js.

## Setup

```sh
cp .env.example .env
```

Edit `.env`:

- `GEMINI_API_KEY` — get one free at <https://aistudio.google.com/apikey>
- `APP_PASSWORD` — the shared password your buddies type in to sign in
- `SESSION_SECRET` — `python -c "import secrets; print(secrets.token_urlsafe(48))"`

### Resumes

Each user uploads their own resumes via Settings (`/settings`). Files are stored under `resumes/uploads/` and are scoped to the user account.

## Run (local)

```sh
docker compose up --build
```

Frontend at <http://localhost:3000>, backend at <http://localhost:8000>. Sign in with any username — a profile is created automatically the first time. The shared `APP_PASSWORD` gates entry.

### Without Docker

Backend:

```sh
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend:

```sh
cd frontend
npm install
npm run dev
```

## Deploy (you + a few buddies, internet-accessible)

The compose file ships with an optional Caddy reverse proxy that handles HTTPS via Let's Encrypt automatically. You need:

1. A small VPS (any provider, $5–10/mo is plenty).
2. A domain pointing at the VPS public IP (`A` record).
3. Edit `Caddyfile` — replace `jobhunter.example.com` with your domain and `you@example.com` with your email.

In `.env` set:

```
APP_PASSWORD=<strong-random-string>
SESSION_SECRET=<token_urlsafe(48)>
COOKIE_SECURE=true
CORS_ORIGINS=https://jobhunter.example.com
PUBLIC_API_URL=https://jobhunter.example.com/api
```

Then:

```sh
docker compose --profile proxy up -d --build
```

Caddy listens on 80/443, proxies `/api/*` to the backend and everything else to the frontend. TLS certs are issued and renewed automatically.

## Backups

The backend writes a daily SQLite snapshot to `data/backups/`. Older snapshots are pruned per `BACKUP_KEEP_DAYS` (default 14). The mount in `docker-compose.yml` makes them visible on the host.

## Tests

```sh
cd backend
pytest
```

## Usage

1. Sign in at the root URL.
2. Upload at least one resume on `/settings`.
3. Click **sync** in the masthead and wait ~30 seconds.
4. Jobs appear with match scores. Click into a job to see breakdown and tailor a resume.

## Seed data (for testing)

Fetches 5 jobs from Indeed only — useful for testing without hammering all sources:

```sh
cd backend
python seed.py
```
