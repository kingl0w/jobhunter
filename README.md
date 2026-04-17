# job-hunter

Fetches remote job postings from multiple boards, scores them against your resumes, and generates tailored resumes for the best matches. Built with FastAPI, Next.js, and Claude.

## Setup

```sh
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Drop your two base resumes into the `resumes/` directory:

```
resumes/base_it.docx
resumes/base_dev.docx
```

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
