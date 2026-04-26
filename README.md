# jobhunter

Fetches remote job postings from multiple boards, scores them against your resumes via keyword and synonym matching, and generates tailored resumes for the best matches using Gemini. Built with FastAPI, and Next.js

## Setup

```sh
cp .env.example .env
```

Edit `.env` and add your Gemini API key (used for resume tailoring and job summarization — scoring runs locally without an LLM):

```
GEMINI_API_KEY=...
```

### Resumes

No resumes are bundled with this repo. Place your own `.docx` resume files in the `resumes/` directory, then upload them via the Settings page at `http://localhost:3000/settings` once the app is running. Resume files are gitignored and stay local.

## Run

**Backend** (Docker):

```sh
docker compose up --build
```

**Backend** (local, no Docker):

```sh
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend**:

```sh
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:8000`, frontend on `http://localhost:3000`.

## Usage

1. Open `http://localhost:3000`
2. Click **Sync Now** and wait ~30 seconds
3. Jobs appear with match scores against both resumes
4. Click into a job to see the full description, keyword breakdown, and tailor a resume

## Seed data (for testing)

Fetches 5 jobs from Indeed only — useful for testing without hammering all sources:

```sh
cd backend
python seed.py
```
