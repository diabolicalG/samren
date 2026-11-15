# Samren Phase 3 — Implementation Progress

**Status:** IN PROGRESS — implementation not yet accepted
**Branch:** `phase-3-media-providers`
**Scope authorization:** Product-owner revision dated 2026-11-15
**Baseline:** `dcbc460639d5cf6ee7b2debcd3adee7e9f888bee`
**Latest checkpoint:** `8b93a7dd88d83a8a9dbe3248b1cf36f28e6c31d1`

## 1. Repository verification

- Active repository confirmed: `diabolicalG/samren`.
- Work is isolated on `phase-3-media-providers`; `main` was not changed.
- Reference repository: `diabolicalG/Anime-streaming`; inspected read-only.
- Phase 1 and Phase 2 documentation and baseline Prisma models were inspected.
- No Phase 3 implementation files were present in the Samren baseline tree. The backend contains the Phase 2 catalogue/admin metadata layer, but no local upload/storage/delivery/playback modules.
- Existing Prisma models already provide `MediaAsset`, `EpisodeMedia`, and `SubtitleTrack`; Phase 3 should extend their lifecycle without duplicating these models.

## 2. Scope revision committed

The product owner's option-B instruction is recorded in `PHASE_3_SCOPE.md` Section 13. It authorizes Kuhi and native Anivexa integration in addition to first-party local media. This amendment supersedes only the former provider exclusions; it does not authorize arbitrary URL proxying or modifications to Anime-streaming.

## 3. Source audit findings

### Kuhi

- Anime-streaming contains a TypeScript `KuhiProvider` client and provider contracts.
- The Kuhi service itself is represented in the reference repository tree as a Git submodule at `services/kuhi`, gitlink commit `d9a785ad030d6fc6a8ad709291be9612c864449e`.
- The reference repository tree does not contain a root `.gitmodules` file, so the submodule's canonical repository URL cannot be established from the inspected source.
- The client code alone does not provide the Kuhi service implementation. Integrating a URL without confirming its canonical source and endpoint ownership would be unsafe and would invent provenance.
- **BLOCKED:** obtain the Kuhi submodule URL/source or an authorized local clone before copying the service itself. Do not fabricate the source.

### Anivexa

- The reference contains a standalone Node.js API aggregator, twelve provider modules, AniList mapping/cache/episode-strategy modules, and six extractor modules plus FlixCloud support.
- Its runtime dependencies include `playwright-core` and `wreq-js`; it is not a small TypeScript provider client.
- The current provider modules perform remote-site scraping and some provider handlers include browser/request-impersonation behavior. Several responses contain remote URLs, headers, cookies, diagnostics, or raw upstream errors.
- The reference README documents routes for AniList mapping, episode discovery, and provider watch resolution. It also documents provider-specific playback constraints.
- The Anivexa source includes wildcard CORS and returns raw error details in some paths. These behaviors must not be copied into Samren.
- **NOT SAFE TO PORT BLINDLY:** each provider/extractor needs an endpoint, dependency, redirect, SSRF, response-size, timeout, credential/logging, and license audit before adoption. Preserve only required functionality and attribution.

## 4. Initial completion matrix

| Area | Initial status | Evidence / next work |
|---|---|---|
| Local storage adapter | MISSING | No storage module or configured storage root found |
| Upload route | MISSING | Admin currently registers metadata, not file bytes |
| Signature verification/checksum | MISSING | Existing schema has checksum/state fields only |
| Media delivery / byte ranges | MISSING | No first-party media route found |
| Playback metadata endpoint | MISSING | No episode playback endpoint found |
| Frontend watch player | MISSING | Existing frontend watch route is not part of the active Phase 2 app |
| Artwork delivery | MISSING | Existing catalogue returns metadata, no generated media URL |
| Kuhi client adaptation | BLOCKED / PARTIAL SOURCE | Reference client exists; source service submodule URL unavailable |
| Anivexa provider/extractor port | NOT STARTED | Large source/dependency/security audit required |
| Automated Phase 3 tests | MISSING | Add alongside each implementation unit |
| Final security audit | NOT STARTED | Required before Phase 3 completion |

## 5. Implementation guardrails

- Local assets and remote provider streams remain separate paths.
- Only local uploads become `MediaAsset` records.
- Do not persist remote stream URLs as local storage keys.
- Do not proxy arbitrary client-supplied URLs.
- Do not expose provider headers, cookies, secrets, raw errors, stack traces, or upstream diagnostics.
- Do not import browser automation or request-impersonation packages without a provider-specific justification and CI test plan.
- Preserve existing ADMIN and trusted-Origin middleware.
- Keep all changes in Samren and do not modify Anime-streaming.

## 6. Verification status

This checkpoint is documentation and source-audit work only. No application code, schema migration, or runtime behavior has been changed. No tests are claimed as run by this checkpoint.

## 7. Next implementation checkpoints

1. Resolve the Kuhi submodule source URL and audit its license/runtime.
2. Define Samren-native provider contracts and security boundary tests.
3. Implement local filesystem storage and upload validation.
4. Implement publication-aware media delivery and byte ranges.
5. Implement playback metadata and frontend player.
6. Port the approved Anivexa provider/extractor subset with per-provider tests.
7. Run full CI, security audit, and Phase 2 regression suite.
8. Freeze Phase 3 only after all acceptance gates pass.
