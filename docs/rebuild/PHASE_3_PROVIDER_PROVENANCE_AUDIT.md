# Samren Phase 3 — Provider Provenance Audit

**Date:** 2026-11-20  
**Changed repository:** diabolicalG/samren only  
**Read-only reference:** diabolicalG/Anime-streaming (main)  
**Samren branch:** phase-3-media-providers  
**Status:** Blocking provenance remediation required before distribution.

## 1. Repository boundary

The Anime-streaming repository was inspected read-only. No branch, file, issue, pull request, setting or commit in Anime-streaming was changed.

The user-approved Option B amendment authorizes Kuhi and native Anivexa provider integration in Samren. It does not authorize copying unlicensed third-party source code or changing Anime-streaming.

## 2. Anivexa provenance

A Git blob comparison was performed between Samren's apps/backend/src/anivexa tree and corresponding relative paths in Anime-streaming's apps/anivexa-api tree.

Eight exact blob matches were found:

- core/episode-cache.js
- extractors/byse.js
- extractors/datasv.js
- extractors/nova.js
- extractors/vidmoly.js
- extractors/vidplay.js
- providers/animenosub.js
- providers/anipm.js

The public Anivexa-API repository is maintained separately at https://github.com/walterwhite-69/Anivexa-API. Its GitHub repository metadata reports no license, and no LICENSE file was found in the Anime-streaming root or its apps/anivexa-api directory. The public README is an API description, not a code license. GitHub's licensing guidance explains that when a repository has no license, default copyright applies and others do not receive permission to reproduce, distribute or create derivative works: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository.

**Required action:** clean-room rewrite the eight exact-match modules from documented public behavior and protocol contracts, or obtain explicit compatible permission from the copyright holder. Do not copy their implementation text, constants, algorithms or source snippets into the replacement.

The prior readiness audit listed three exact matches. That count is superseded by this broader blob-level comparison, which found eight.

## 3. Anivexa operating constraints

The Anivexa-API README documents a public API contract using AniList IDs for mapping, episode discovery and provider-specific watch resolution. Its contributing guidance states that new providers should self-host their content and that third-party-site scrapers are not wanted: https://github.com/walterwhite-69/Anivexa-API#contributing.

Samren's provider work must therefore:
- Use only providers whose content is self-hosted/authorized for this integration.
- Avoid adding scrapers for unrelated third-party sites.
- Treat provider coverage as best-effort, never guaranteed.
- Keep provider URL resolution server-side.
- Never accept raw upstream URL or referer values from the client.
- Replace the current raw URL/referer relay contract with short-lived opaque handles bound to a playback session.
- Validate host, scheme, DNS result, redirects, response size, content type and timeout at every upstream fetch.

## 4. Kuhi provenance and service boundary

The accessible Kuhi API v3 source under Anime-streaming/apps/kuhi-api includes an MIT license. If any source is reused, preserve the MIT license text and attribution. The service shell's wildcard CORS and caller-supplied URL proxy routes are not approved for copying. The Samren service must bind to loopback, expose only required provider search/episode/extraction operations, and use the active Express backend's typed client contract.

The earlier legacy Python implementation under Samren/apps/api is not the active runtime and remains outside the Phase 3 change boundary.

## 5. Current runtime and remediation plan

The Anivexa router is mounted in Samren's active Express application but disabled by default. The raw URL/referer proxy contract is still a blocking security issue.

Required sequence:
1. Replace the raw URL/referer route with session-bound opaque media-resource handles.
2. Audit and clean-room rewrite the eight exact-match modules.
3. Audit remaining Anivexa modules for substantial copied implementation text before distribution.
4. Implement only the approved/self-hosted provider subset with explicit tests and failure isolation.
5. Integrate Kuhi through the approved loopback service boundary and preserve MIT attribution.
6. Add/verify AniList identity mapping and provider mapping using the reference architecture without copying its implementation.
7. Verify rate limiting, SSRF controls, session expiry/cancellation and provider failure isolation.
8. Audit each provider integration checkpoint before enabling it by default.

## 6. Acceptance

This provenance audit is complete. The code remediation is **not** complete. No provider source is license-cleared merely because it exists in the reference repository or in Samren's current branch.

Anime-streaming remains unchanged and read-only.
