# Contributing to OpenCSR

Thank you for helping! OpenCSR is a community project under the Apache License 2.0; by contributing you agree your contributions are licensed under it.

## Getting started

```bash
npm install
cp .env.example .env            # local PostgreSQL + AUTH_SECRET
npx prisma migrate deploy
ADMIN_PASSWORD='Local-Admin-123' npm run admin:create -- --email admin@example.org --org-name "Local Org" --org-slug local-org
npm run seed:demo               # optional fictional demo data
npm run dev
```

## Before opening a pull request

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Run `npm run test:e2e` when you change UI workflows (see `playwright.config.ts`).

## Ground rules

- **All data access goes through `src/server/services`.** Every service function takes an `OrgContext`, validates input with Zod, calls `assertCan`, scopes queries by `organisationId`, writes an audit entry for meaningful changes, and uses a transaction for multi-record writes. Add a tenant-isolation test for new models.
- **Never trust the browser** for organisation IDs, permissions or HTML. Sanitise rich text on the server; validate links with `zHref`.
- **Schema changes** need a Prisma migration (`npm run db:migrate -- --name …`). Never edit released migrations.
- **No real organisation data** in seeds, fixtures, screenshots or docs. Use clearly fictional data and `example.org` addresses.
- **No proprietary or paid dependencies** for core features. Check licences of new dependencies and assets.
- Keep the UI accessible: labels for every input, keyboard support, visible focus, and never colour alone for status.

## Reporting bugs and security issues

Use GitHub issues for bugs and features. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
