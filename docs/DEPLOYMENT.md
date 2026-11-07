# Deployment

## App (Next.js, Node 22.13+)
FoodDecode stores data in a SQLite file, so deploy it to a host with a **persistent disk** (a VM, Fly.io/Render/Railway with a volume, or a container with a mounted volume). Serverless platforms with ephemeral filesystems are not suitable without switching to Postgres (see below).

```bash
npm ci
npm run build
export NODE_ENV=production
export FD_DATA_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")   # store in your secret manager
export FD_DB_PATH=/var/lib/fooddecode/fooddecode.db
npm run seed            # optional demo accounts
npm start               # port 3000; put HTTPS (Caddy/nginx/platform TLS) in front
```

- Keep `FD_DATA_KEY` secret and backed up: without it stored profiles cannot be decrypted. Rotating it requires re-encrypting rows (not automated).
- Serve over HTTPS only. Cookies are `Secure` in production; `FD_INSECURE_COOKIES=1` is for local http testing only.
- Back up the DB file (`sqlite3 … .backup`) — it contains only ciphertext for health data.
- Run a single app instance (rate limiting is in-memory; SQLite is single-writer).

## OCR service (optional)
```bash
cd services/ocr-server
docker build -t fooddecode-ocr .          # Dockerfile provided, not exercised in tests
docker run -p 127.0.0.1:8765:8765 -e OCR_SERVICE_TOKEN=change-me fooddecode-ocr
```
or `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && OCR_SERVICE_TOKEN=change-me .venv/bin/python server.py`.
Set `OCR_SERVICE_URL` and the same `OCR_SERVICE_TOKEN` in the app's environment. Keep the service on a private network; only the app talks to it. CPU-only; ~2–3 s per label on the test machine.

## Supabase / Postgres option
`db/postgres/001_supabase_rls.sql` contains the schema with Row Level Security (owner-only policies; profile insert requires consent). To use it, replace `src/lib/server/db.ts`, `auth.ts` and `repo.ts` with Supabase Auth and a Postgres client; keep the app-level encryption. This path is **documented but untested**.

## Environment variables
See `.env.example`.
