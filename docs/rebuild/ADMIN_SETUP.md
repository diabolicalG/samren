# Samren administrator setup

This guide provisions the first administrator for a self-hosted Samren installation. It does not create a public registration flow or an unauthenticated administrator endpoint.

## Before provisioning

1. Configure PostgreSQL and set `DATABASE_URL` for the backend.
2. Set `NODE_ENV=production` for a production deployment. Production session cookies are marked `Secure`.
3. Set `CORS_ORIGIN` to the exact browser origin(s) that host the frontend, comma-separated. Do not use a wildcard. The development default allows only the active Vite frontend at `http://localhost:5173`. Add another exact origin only when a separately deployed trusted frontend requires it.
4. If Samren is behind a reverse proxy, set `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops (commonly `1` behind one controlled proxy). Leave it at `0` when the API is directly exposed. Do not set a larger value than the actual trusted proxy chain.

## Apply database migrations

From the repository root:

```sh
pnpm --filter @samren/backend db:migrate:deploy
```

## Create the initial administrator

Supply credentials through your deployment secret manager or the process environment. Do not commit them to source control, paste them into CI logs, or place them in a checked-in `.env` file.

Example for a one-time local shell invocation:

```sh
read -r -p "Administrator email: " BOOTSTRAP_ADMIN_EMAIL
read -r -p "Administrator username: " BOOTSTRAP_ADMIN_USERNAME
read -r -s -p "Administrator password (minimum 16 characters): " BOOTSTRAP_ADMIN_PASSWORD
printf '\\n'
export BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_USERNAME BOOTSTRAP_ADMIN_PASSWORD
pnpm --filter @samren/backend admin:bootstrap
unset BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_USERNAME BOOTSTRAP_ADMIN_PASSWORD
```

The bootstrap command:
- requires all three values and a password of at least 16 characters;
- stores a salted scrypt password hash, never the plaintext password;
- creates an `ADMIN` account only when the email is unused;
- refuses to elevate an existing non-admin account or overwrite an existing administrator.

The command is intentionally one-time. There is no password reset or role-elevation endpoint in this phase. If bootstrap reports that the administrator already exists, sign in with that account; do not rerun bootstrap to replace it.

## Session and request protections

- Session tokens are generated from cryptographically secure random bytes. Only SHA-256 token hashes are stored in PostgreSQL.
- Session cookies are `HttpOnly`, `SameSite=Strict`, scoped to `/api/v1`, and expire after 12 hours. Production cookies also use `Secure`.
- Login, logout and catalogue mutations require an exact allowed `Origin`.
- Failed login attempts are rate-limited per client IP in the running API process. For multi-instance production deployments, add a shared rate-limit store at the edge or in a shared service before exposing the login endpoint publicly; the in-process counter is not a distributed limit.
- Every admin catalogue route requires a database-backed session and the current database role to be `ADMIN`. The API does not trust a role supplied by the browser.
- Catalogue records are archived rather than hard-deleted through the admin API.

## Current scope limits

This bootstrap is for the first administrator only. Public user registration, password reset, MFA, session refresh/rotation, account recovery, and a distributed login-rate-limit backend are not implemented. Treat the administrator credential as a deployment secret and use HTTPS in production.
