# Self-hosting OpenCSR

OpenCSR runs anywhere you can run Node.js 20.18+ (or Docker) and PostgreSQL 14+. No account with the original developers or any paid service is required.

## Environment variables

Copy `.env.example` to `.env`. Variables are validated when the server starts; invalid configuration stops start-up with a clear message.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_URL` | yes (prod) | Public base URL, e.g. `https://csr.example.org`. HTTPS enables secure cookies |
| `AUTH_SECRET` | yes | ≥ 32 random characters (`openssl rand -base64 48`). Placeholder values are rejected in production |
| `SESSION_TTL_HOURS` | no | Session lifetime (default 168) |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` |
| `STORAGE_LOCAL_DIR` | no | Directory for local files (default `./storage`) — back it up |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | for S3 | Any S3-compatible service (AWS S3, MinIO, Cloudflare R2, Backblaze B2, Wasabi). Keep the bucket **private**; OpenCSR serves files itself after authorisation |
| `UPLOAD_MAX_MB` | no | Upload limit, default 15, maximum 25 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | no | Email for password resets, member invitations and enquiry alerts. Without it, everything is still stored and shown in the dashboard; administrators can generate password-reset links |
| `ENABLE_INTERNAL_SCHEDULER` | no | `true` (default) runs jobs every minute in the server process |
| `JOBS_SECRET` | no | Enables `POST /api/jobs/run` for external cron |
| `DEFAULT_ORGANISATION_SLUG` | no | Organisation served on hosts that don't match a configured custom domain |
| `LOG_LEVEL` | no | `debug`, `info` (default), `warn`, `error` |

## Option 1 — Docker Compose (single server)

```bash
cp .env.example .env
# edit: AUTH_SECRET, POSTGRES_PASSWORD, APP_URL
docker compose up -d --build
docker compose logs -f app
```

Create the first administrator either at `https://your-host/setup` or:

```bash
docker compose exec -e ADMIN_PASSWORD='a-strong-password' app \
  node dist-scripts/create-admin.js --email you@example.org --name "Your Name"
```

Optional demo data: `docker compose exec app node dist-scripts/seed-demo.js --admin you@example.org`.

Put a TLS-terminating reverse proxy (Caddy, nginx, Traefik) in front and forward `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` and `X-Forwarded-For`.

## Option 2 — Railway

1. Create a project with a **PostgreSQL** service and a service from this repository (Railway uses `railway.json` and the `Dockerfile`).
2. Set variables on the app service: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `APP_URL`, `AUTH_SECRET`, and (recommended, because container disks are ephemeral) S3-compatible storage variables, or attach a Railway volume at `/app/storage`.
3. Deploy. Migrations run on start; the health check is `/api/health`.
4. Create the admin: open the deployed URL at `/setup`, or run `node dist-scripts/create-admin.js --email … --name …` via `railway run`/a one-off shell.
5. Optional: disable the internal scheduler and create a Railway cron that calls `POST /api/jobs/run` with `Authorization: Bearer $JOBS_SECRET`.

## Option 3 — Bare metal / VM

```bash
npm ci
npx prisma migrate deploy
npm run build
NODE_ENV=production node .next/standalone/server.js   # or: npm start
```

When running `.next/standalone/server.js` directly, copy `.next/static` to `.next/standalone/.next/static` and `public/` to `.next/standalone/public` (the Dockerfile does this). Use systemd or a process manager to restart on failure; the server shuts down gracefully on `SIGTERM`.

## Multiple organisations and custom domains

Platform administrators create organisations under **Account menu → Organisations**. Each organisation can set a host name in **Organisation Settings → Website domain**; point that DNS name at the server. Requests for unknown hosts show `DEFAULT_ORGANISATION_SLUG` or the platform default organisation.

## Production checklist

- [ ] Strong unique `AUTH_SECRET`; HTTPS `APP_URL`
- [ ] Database backups scheduled and restore tested ([backup-restore.md](backup-restore.md))
- [ ] Persistent file storage (volume or private S3 bucket) included in backups
- [ ] SMTP configured, or administrators know how to issue reset links
- [ ] Demo data not seeded, or removed (`demo:remove --yes`) and demo mode disabled
- [ ] Legal pages (privacy, terms) replaced with your own reviewed text — the defaults are templates
