# Security policy

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private vulnerability reporting (“Security” tab → “Report a vulnerability”) on this repository. Include steps to reproduce, affected versions and impact. We aim to acknowledge reports within 5 working days and will coordinate disclosure with you.

## Supported versions

Security fixes are made on the latest release.

## Security design summary

- Server-side authorisation on every operation; organisation isolation enforced in the service layer and covered by tests.
- bcrypt password hashing; hashed session and reset tokens; secure, HttpOnly, SameSite cookies; login and enquiry rate limiting.
- Zod validation of all input; allow-list HTML sanitisation; restricted link schemes; validated theme tokens (no user CSS/JS).
- Upload content sniffing; SVG/HTML rejected; private files served only after authorisation with `nosniff` and a restrictive CSP.
- Secrets only in environment variables, validated at start-up; secrets redacted from audit logs.

See [docs/architecture.md](docs/architecture.md) for details.

## Operator responsibilities

Use HTTPS, a strong `AUTH_SECRET`, a private storage bucket, regular encrypted backups and timely upgrades.
