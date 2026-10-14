# Data handling and privacy

This describes what OpenCSR stores and how. Each installation's operator is the data controller and is responsible for its own privacy notices, retention and legal compliance.

## Personal data stored

| Data | Where | Who can see it |
| --- | --- | --- |
| User name, email, bcrypt password hash, last sign-in | `User` | Organisation administrators (members of their organisation) |
| Session token hashes, IP address, user agent | `Session` | Not shown in the UI; expired sessions are purged |
| Partner contact persons, partner email/phone, due-diligence answers, internal notes | `PartnerContact`, `PartnerOrganisation` | Roles with `partner.confidential` only |
| Enquiry name, email, phone, organisation, message, consent flag | `Enquiry` | Roles with `enquiry.read` |
| Enquiry IP address | stored only as a keyed hash (`ipHash`) for rate limiting | — |
| Audit trail (actor, action, record, change metadata, IP) | `AuditLog` | Roles with `audit.read` |

Passwords, tokens and secrets are never written to audit logs (keys matching password/token/secret/hash/authorization are redacted).

## Files

Documents and private media are stored in the configured storage backend and are only served after authentication, membership and permission checks. Public media is served only when explicitly marked public. Use a **private** S3 bucket.

## Public website

Only explicitly published content is public: projects marked “publish on website” (never internal notes, risks, budgets or private files), published pages and posts, approved public documents, published reports and *verified* impact values.

## Retention and deletion

- Enquiries can be closed and exported; delete records directly in the database if your policy requires erasure.
- Removing a member deletes their membership; the user account and authored history remain for audit purposes. Deactivate accounts that should no longer sign in.
- Deleting an organisation (platform admin) permanently removes all of its records and stored files.

## Backups

Backups contain all of the above. Encrypt them and restrict access — see [backup-restore.md](backup-restore.md).
