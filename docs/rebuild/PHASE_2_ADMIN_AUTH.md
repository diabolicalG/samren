# Samren Phase 2 — Administrator access

## Authentication design

- Administrator sign-in uses a first-party opaque session token generated with Node's cryptographic random generator.
- Only a SHA-256 hash of the session token is stored in the existing `RefreshToken` table.
- Passwords are hashed with Node.js scrypt and a unique random salt. Plaintext passwords are never stored or logged.
- The browser receives a 12-hour `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/v1`; production cookies also set `Secure`.
- Mutating authentication and catalogue-admin requests require an exact allowed `Origin` from `CORS_ORIGIN`.
- Login failures receive a generic credential error and a per-process attempt limit. Production deployments with multiple API instances should also enforce shared rate limiting at the reverse proxy or edge.
- Admin endpoints require a verified session and the `ADMIN` role. Client-side UI visibility is not an authorization boundary.

## Provision the first administrator

There is deliberately no public registration or public role-escalation endpoint. Provision the first administrator from a trusted server shell after the database migration has been deployed.

From the repository root:

```bash
export BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
export BOOTSTRAP_ADMIN_USERNAME="site-admin"
read -r -s -p "Initial administrator password (minimum 16 characters): " BOOTSTRAP_ADMIN_PASSWORD
printf '\n'
export BOOTSTRAP_ADMIN_PASSWORD
pnpm --filter @samren/backend admin:bootstrap
unset BOOTSTRAP_ADMIN_PASSWORD
unset BOOTSTRAP_ADMIN_EMAIL
unset BOOTSTRAP_ADMIN_USERNAME
```

The command creates a new ADMIN account only. It refuses to elevate an existing non-admin account and refuses to overwrite an existing administrator. Keep the password in a secure password manager.

## Admin workspace

- Visit `/admin` on the frontend.
- Sign in with the provisioned administrator account.
- Create catalogue drafts, publish or unpublish entries, and archive entries.
- Archiving is a soft state change; it does not hard-delete the anime record or its related episodes.
- Public catalogue endpoints return only `PUBLISHED` entries.
- Taxonomy relations must reference existing first-party genres, studios and seasons.
- Media uploads, media delivery, episode playback and storage administration remain outside Phase 2.

## Operational notes

- Session records use the existing `RefreshToken` Prisma model and are revoked on logout.
- Use HTTPS in production so the `Secure` cookie attribute is active.
- Set `CORS_ORIGIN` to the exact production frontend origin(s); do not use a wildcard with credentialed requests.
- The CI PostgreSQL service is disposable test infrastructure. This documentation does not imply a production database has been provisioned.
