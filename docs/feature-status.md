# Feature status, limitations and roadmap

Status of release **0.1.0**. “Implemented” means the feature persists data in PostgreSQL, enforces permissions on the server and is reachable from the UI. Items verified by automated tests are marked ✅T.

## Implemented

| Area | Status |
| --- | --- |
| Setup wizard, CLI admin creation, no public registration | Implemented ✅T (setup refusal) |
| Login/logout, DB sessions, bcrypt, rate limiting, password reset (email or admin link), password change | Implemented ✅T |
| Nine roles, granular permissions, server-side checks | Implemented ✅T |
| Multi-organisation isolation, organisation switcher, platform admin organisation management, custom domains | Implemented ✅T (isolation suite) |
| Focus areas, programmes, projects (all listed fields, team, milestones, tasks, images, evidence, history, archive/restore, CSV export, public pages) | Implemented ✅T |
| Partner CRM (profiles, contacts, configurable due diligence, verification states, agreements, disbursements, follow-up tasks, activity, CSV) | Implemented ✅T (isolation, confidentiality) |
| Budgets (plans, allocations, committed/incurred expenditure, disbursements, locks, CSV, audit history, plan approval) | Implemented ✅T (calculations, overspend, decimals) |
| Impact (indicators, measurements, evidence, verification by another person, charts, printable report, CSV, public verified-only values) | Implemented ✅T |
| Tasks (assignees, priorities, dependencies with cycle check, reminders, comments, history) | Implemented |
| Approvals (website publish, report publish, budget changes on approved plans, project status, impact verification) | Implemented ✅T (website, project status) |
| Documents (private storage, versions, visibility levels, review workflow, public download after approval) | Implemented ✅T |
| Reports (annual/project/impact/budget generated from records, frozen on approval, print view, PDF, public publication) | Implemented ✅T |
| Blog CMS (TipTap editor, categories, tags, author profiles, drafts, scheduling, SEO fields, canonical, OG image, JSON-LD, RSS, sitemap, related posts, search, pagination) | Implemented ✅T (draft privacy, scheduling job) |
| WordPress import (WXR export file: posts, statuses, dates, categories, tags, excerpts, Yoast SEO descriptions, featured and inline images copied to the media library with SSRF protection, idempotent re-import) | Implemented ✅T |
| Public website (home, CSR pages, projects, blog, reports, contact, privacy/terms templates, 404, SEO, sitemap, robots) | Implemented ✅E2E |
| Website builder (all routes in the specification, 16 sections, tokens, templates, previews, publish, revisions, rollback) | Implemented ✅T ✅E2E |
| Media library (validated uploads, alt text, visibility, replace, usage-checked delete, picker) | Implemented ✅T (type detection, access) |
| Enquiries (validation, honeypot, timing token, rate limit, storage, notifications, optional email, statuses, CSV) | Implemented ✅T |
| In-app notifications and audit log (with secret redaction, CSV export) | Implemented ✅T (redaction) |
| Docker, Compose, Railway config, health endpoint, env validation, structured logs, graceful shutdown, CI | Implemented (see “Not verified” below) |

## Known limitations

- **Accounting & compliance** — budget tracking is not an accounting system; no statutory compliance is claimed.
- **Approval chains** — each approval needs one reviewer; multi-step approval chains are not supported.
- **Email** — sent for password resets, member invitations and new enquiries only. Other notifications are in-app.
- **Report PDFs** use standard PDF fonts, so non-Latin characters (e.g. Devanagari) are replaced in the PDF; the HTML/print view renders them correctly.
- **Images** are served as uploaded (no automatic resizing or `srcset`). Upload appropriately sized images.
- **Builder** — drag-and-drop works in the section list (arrow buttons are the accessible alternative); there is no drag on the canvas, no per-keystroke undo (use Discard or revisions), and navigation supports one dropdown level.
- **Organisation time zone** is stored but dates are displayed in the server's/browser's locale formatting (UTC for date-only fields).
- **Cache after CLI changes** — content changed by CLI scripts (seed, remove) may take up to an hour to appear on an already-running server's public pages, because scripts cannot invalidate the server cache. Restart the server or publish from the dashboard to refresh immediately.
- **Platform administrators** can access every organisation by design.
- **Sessions** have a fixed lifetime (no sliding renewal).
- The UI is English-only (content can be in any language; Devanagari fonts are bundled).
- **WordPress import** covers posts only (not pages, comments, menus or custom post types). Imported posts are authored by the importing user. Shortcodes are removed. Files up to 25 MB; at most 300 images per import. Image copying makes direct outbound HTTP(S) requests, so it needs the WordPress site to be publicly reachable and does not go through an outbound proxy; failed images keep linking to the original site and are listed in the import report.
- No CSV/Excel bulk import, data-subject export, or two-factor authentication yet.

## Not verified in the development environment

- The Docker image build (no Docker daemon was available); the standalone runtime layout it produces was verified by running `server.js` and the bundled CLI scripts.
- The S3 storage adapter and SMTP delivery (no S3 endpoint or mail server available). Both use standard libraries (`@aws-sdk/client-s3`, `nodemailer`).
- Railway deployment.

## Roadmap ideas

Two-factor authentication · WordPress pages import · CSV/Excel import · multi-step approvals · image resizing · data export for data-subject requests · translations · webhooks/API tokens · per-organisation SMTP settings.
