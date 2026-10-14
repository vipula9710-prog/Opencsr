# Backup, restore and upgrades

OpenCSR stores everything in two places:

1. **PostgreSQL** — all records, website drafts/versions, audit logs and file metadata.
2. **File storage** — uploaded files (`STORAGE_LOCAL_DIR`, default `./storage`, or your S3 bucket).

Back up both, at the same time, and test restores regularly.

## Backup

```bash
# Database (custom format, compressed)
pg_dump --format=custom --no-owner --file=opencsr-$(date +%F).dump "$DATABASE_URL"

# Local file storage
tar -czf opencsr-files-$(date +%F).tar.gz -C /path/to/storage .
```

Docker Compose:

```bash
docker compose exec -T db pg_dump -U opencsr --format=custom opencsr > opencsr-$(date +%F).dump
docker run --rm -v opencsr_storage:/data -v "$PWD":/backup alpine tar -czf /backup/opencsr-files-$(date +%F).tar.gz -C /data .
```

(The volume name is prefixed with your Compose project name — check `docker volume ls`.)

For S3 storage, enable bucket versioning and/or replicate the bucket with your provider's tools (`aws s3 sync`, `rclone`).

Keep backups encrypted and off-site: they contain personal data (enquiries, partner contacts) and confidential documents.

## Restore

1. Stop the application.
2. Restore the database into an empty database:
   ```bash
   createdb opencsr_restored
   pg_restore --no-owner --dbname=postgresql://user:pass@host:5432/opencsr_restored opencsr-2026-01-31.dump
   ```
3. Restore files into the storage directory (or bucket) at the same paths:
   ```bash
   tar -xzf opencsr-files-2026-01-31.tar.gz -C /path/to/storage
   ```
4. Point `DATABASE_URL` at the restored database and start the application. `prisma migrate deploy` (run automatically in Docker) applies any newer migrations.
5. Sign in and check a few documents, images and the public website.

## Upgrading

1. Read [CHANGELOG.md](../CHANGELOG.md) for breaking changes.
2. **Back up** the database and files.
3. Update the code (`git pull` or a new image tag) and install dependencies (`npm ci`).
4. Apply migrations: `npx prisma migrate deploy` (Docker does this on start).
5. Build and restart: `npm run build && npm start`, or `docker compose up -d --build`.
6. Check `/api/health` and sign in.

Migrations are forward-only. To roll back an upgrade, restore the backup taken before it and redeploy the previous version.

## Creating migrations (developers)

Change `prisma/schema.prisma`, then run `npm run db:migrate -- --name describe_change`, commit the generated folder under `prisma/migrations`, and never edit a migration that has been released.
