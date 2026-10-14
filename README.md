# OpenCSR

**Free, open-source, self-hostable Corporate Social Responsibility (CSR) management and website platform.**

OpenCSR combines a CSR CRM, project management, budget and impact tracking, NGO/partner management, reporting, a blog CMS and a visual website builder in one application. It is licensed under the [Apache License 2.0](LICENSE). There are no subscriptions, paywalls, licence checks or feature gates, and the core application needs no paid services.

> The repository ships an optional demo organisation, **GreenFuture Foundation**. It is **fictional** — every organisation record, person, partner and figure in the demo is invented and is labelled as such in the dashboard and on the website.

## Features

| Area | What you get |
| --- | --- |
| Organisations | Multiple isolated organisations, setup wizard, own branding, domain, currency and financial year |
| Access control | Nine roles (platform admin → read-only viewer), granular permissions, server-side checks on every operation, audit log |
| CSR programmes & projects | Configurable focus areas, programmes, projects with objectives, owners, team, partners, risks, dependencies, milestones, tasks, evidence, images, status history, archive/restore, CSV export |
| NGO & partner CRM | Profiles, contacts, configurable due-diligence fields, honest verification states, review dates, agreements, disbursements, follow-ups, activity history |
| Budgets | Financial-year plans, programme/project allocations, committed vs. utilised expenditure, partner disbursements, decimal-safe arithmetic, overspend protection, CSV export, audit history |
| Impact | Indicators with baselines, targets, definitions; measurements by period with evidence; verification by a second person; charts; printable reports |
| Tasks & approvals | Tasks with assignees, priorities, dependencies, reminders and comments; configurable approval steps for publishing, reports, budgets, project status and impact verification |
| Reports & documents | Private document store with versions, review workflow and visibility levels; generated annual/project/impact/budget reports frozen on approval; PDF and print |
| Website builder | Three-panel visual editor with live desktop/tablet/mobile preview; 16 section types; full colour, typography and component tokens; header/footer; navigation; blog layout; 5 templates; drafts, autosave, publish, discard, revisions and rollback |
| Public website & blog | Database-driven pages, projects, blog (categories, tags, authors, scheduling, RSS), reports, contact form with spam protection, SEO metadata, sitemap, robots.txt, structured data |
| Media library | Uploads with content-type validation, alt text, public/private visibility, replace, reuse; local disk or any S3-compatible storage |

See [docs/feature-status.md](docs/feature-status.md) for a precise implementation status and known limitations.

## Quick start (local development)

Requirements: Node.js 20.18+ (22 recommended), PostgreSQL 14+.

```bash
git clone https://github.com/vipula9710-prog/opencsr.git && cd opencsr
npm install
cp .env.example .env          # set DATABASE_URL and AUTH_SECRET (openssl rand -base64 48)
npx prisma migrate deploy     # create the database schema
npm run dev                   # http://localhost:3000
```

Open <http://localhost:3000/setup> to create your organisation and first administrator in the browser, **or** use the CLI:

```bash
ADMIN_PASSWORD='choose-a-strong-password' npm run admin:create -- --email you@example.org --name "Your Name" \
  --org-name "My Foundation" --org-slug my-foundation
```

Optional demo data (fictional GreenFuture Foundation):

```bash
npm run seed:demo -- --admin you@example.org     # add demo organisation
npm run demo:remove -- --yes                      # remove it again
```

Demo data is never seeded automatically.

## Run with Docker Compose

```bash
cp .env.example .env    # set AUTH_SECRET, POSTGRES_PASSWORD and APP_URL
docker compose up -d --build
docker compose exec app node dist-scripts/create-admin.js --email you@example.org --name "Your Name"
```

Migrations run automatically when the container starts. Files are stored in the `storage` volume.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit and integration tests (needs PostgreSQL; see below) |
| `npm run test:e2e` | Playwright end-to-end tests against a running, seeded server |
| `npm run db:deploy` | Apply migrations |
| `npm run db:migrate` | Create a new migration during development |
| `npm run admin:create` | Create or promote a platform administrator |
| `npm run seed:demo` / `npm run demo:remove` | Add / remove fictional demo data |
| `npm run jobs:run` | Run background jobs once (for external cron) |

Tests use `TEST_DATABASE_URL` (default `postgresql://opencsr:opencsr@localhost:5432/opencsr_test`). Each run creates a fresh, uniquely named schema and drops it afterwards.

## Documentation

- [Self-hosting & deployment](docs/self-hosting.md) — environment variables, Docker, Railway, reverse proxies, email, storage
- [Backup, restore & upgrades](docs/backup-restore.md)
- [Architecture](docs/architecture.md) — including tenant isolation and security design
- [Website builder](docs/website-builder.md)
- [Data handling & privacy](docs/data-handling.md)
- [Feature status, limitations & roadmap](docs/feature-status.md)
- [Third-party licences](docs/third-party-licences.md)
- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Changelog](CHANGELOG.md)

## Important notes

- OpenCSR tracks CSR budgets and spending; it is **not** an accounting system and makes **no claim of statutory or regulatory compliance**. Validate any compliance use independently.
- A partner marked “Verified” means an authorised reviewer in your organisation recorded that internal checks were completed — it is not a legal certification.
- Impact values are “unverified” until a second, authorised person verifies them. Only verified values appear on the public website.

## Licence

Copyright the OpenCSR contributors. Licensed under the Apache License, Version 2.0. Bundled fonts are licensed under the SIL Open Font License 1.1.
