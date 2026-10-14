# Architecture

OpenCSR is a single Next.js (App Router) application backed by PostgreSQL.

```
Browser ──► Next.js (React Server Components, server actions, route handlers)
              │
              ├── src/app/(site)      public website (themed, per-organisation)
              ├── src/app/admin       dashboard (authenticated)
              ├── src/app/api         files, media, exports, preview, health, jobs
              │
              └── src/server          ── all business logic ──
                    services/*.ts     organisation-scoped service functions
                    auth/             sessions, passwords, tokens
                    context.ts        OrgContext (verified user + membership + permissions)
                    storage/          local disk or S3-compatible adapter
                    jobs/             scheduled publishing, reminders, cleanup
              │
              └── Prisma ORM ──► PostgreSQL
```

## Layers

| Layer | Responsibility |
| --- | --- |
| `src/lib` | Pure, client-safe modules: permissions map, money arithmetic, CSV, theme tokens, section registry, link validation |
| `src/server/services` | Every read and write. Each function takes an `OrgContext`, validates input with Zod, checks permissions, scopes queries to the organisation, writes audit logs and uses transactions for multi-record changes |
| `src/app/**/actions.ts` | Thin server actions: build the context from the session, call a service, return a serialisable result |
| `src/components` | UI: admin kit (`ui/`, `admin/`), public site renderer (`site/`), website builder (`builder/`) |

Services never trust identifiers supplied by the browser: the organisation comes from the verified session (`getOrgContext`) and every record ID is checked against that organisation.

## Tenant isolation

1. **Data model** — every organisation-owned table has `organisationId` with a foreign key and index; uniqueness (slugs, financial years) is organisation-scoped.
2. **Context** — `buildOrgContext(user, organisationId)` returns a context only if the user is a platform administrator or has an *active* membership. The active organisation is chosen from a cookie but always re-validated against memberships.
3. **Queries** — services filter with `organisationId: ctx.organisationId` or verify ownership with `ensureOwned()`, which returns *Not found* (not *Forbidden*) for other organisations' IDs to avoid leaking existence (IDOR protection).
4. **References** — foreign IDs inside input (partner, programme, cover image, evidence document, assignee) are validated to belong to the same organisation before use.
5. **Files** — private files are served only by `/api/files/[id]` after session, membership, permission and document-visibility checks. Public media (`/media/...`) serves only assets explicitly marked public and not attached to documents. Unguessable URLs are never treated as authorisation.
6. **Public website** — the organisation is resolved server-side from the request host (custom domain), `DEFAULT_ORGANISATION_SLUG`, or the platform default. Drafts are only rendered in Next.js draft mode *and* when the signed-in user has `website.edit` in that organisation.
7. **Tests** — `tests/integration/tenant-isolation.test.ts` covers reads, writes, cross-references, files, website drafts and versions across two organisations.

Platform administrators have full access to every organisation (documented, by design for self-hosting operators).

## Authentication & sessions

- Passwords hashed with bcrypt (cost 12). Minimum length 10 with mixed character classes.
- Sessions are random 256-bit tokens; only a SHA-256 hash is stored. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` and `__Host-` prefixed when `APP_URL` is HTTPS.
- Login is rate-limited per IP and per account in PostgreSQL (works across instances); messages never reveal whether an account exists.
- Password reset tokens are single-use, hashed, expire after 60 minutes (24 h for admin-generated links) and revoke all sessions.
- There is no public registration. Administrators add members; the first administrator is created by the setup wizard (which refuses to run once any user exists) or `npm run admin:create`.

## Authorisation

Roles map to permission sets in `src/lib/permissions.ts`. Pages call `requireOrgContext(...permissions)`; services call `assertCan(ctx, ...)` independently, so a hidden button is never the only protection.

## CSRF and input handling

- Server actions use Next.js' built-in origin checks; route handlers that mutate state call `assertSameOrigin`.
- All input is validated with Zod on the server. Rich text is sanitised with an allow-list (`sanitize-html`) before storage. Links are restricted to site paths, anchors, `https:`, `mailto:` and `tel:`.
- Theme values are validated enums, numbers and `#RRGGBB` colours; CSS custom properties are generated from them — no user-supplied CSS, JavaScript or HTML is ever executed.
- Uploads are checked by content (magic bytes) and extension; SVG and HTML are rejected; files are served with `nosniff`, a restrictive CSP and `attachment` disposition for non-media types.

## Website builder data flow

```
Draft (editable)                         Published (what visitors see)
WebsiteTheme.draftTokens  ─┐
WebsiteSettings.draftConfig ├─ publish ─► ThemeVersion {tokens, siteConfig, navigation}  ◄─ WebsiteTheme.publishedVersionId
NavigationItem rows       ─┘
PageSection rows          ─── publish ─► PageRevision {snapshot}                        ◄─ Page.publishedRevisionId
```

Publishing validates everything, writes new immutable versions in one transaction, then invalidates the cached public site (`revalidateTag`). Rollback copies an old version into the draft (and optionally publishes it). See [website-builder.md](website-builder.md).

## Money

Amounts are `NUMERIC(16,2)` in PostgreSQL and handled as strings; arithmetic uses integer minor units (`BigInt`) in `src/lib/money.ts`. Allocation and expenditure writes lock the budget plan row (`SELECT … FOR UPDATE`) inside a transaction to prevent concurrent over-allocation.

## Background jobs

`src/server/jobs` publishes due scheduled posts, sends task reminders and deadline notices, flags partner reviews and purges expired sessions. It runs every minute inside the server (disable with `ENABLE_INTERNAL_SCHEDULER=false`) and is guarded by a PostgreSQL advisory lock so multiple instances never run it concurrently. External schedulers can call `POST /api/jobs/run` (Bearer `JOBS_SECRET`) or `npm run jobs:run`. Scheduled posts also become visible at their scheduled time even if the job is late.

## Observability

Structured JSON logs (`src/server/logger.ts`), `GET /api/health` (checks the database), environment validation at start-up (`src/server/env.ts`), graceful shutdown that stops the scheduler and disconnects Prisma.
