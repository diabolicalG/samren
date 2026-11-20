# Samren Phase 3 — Checkpoint 3.5A Audit

**Subcheckpoint:** First-party playback metadata and subtitle API  
**Date:** 2026-11-20  
**Implementation head:** 4986091f1c90a6ca0698d14f95d48048f011dd63  
**CI evidence:** [Run 44738805397](https://github.com/diabolicalG/samren/actions/runs/44738805397)

## 1. Verdict

<badge>ACCEPTED — SUBCHECKPOINT ONLY</badge>

The first-party playback metadata and subtitle API subcheckpoint is accepted. Overall Checkpoint 3.5 — Playback contracts and providers — remains IN PROGRESS.

## 2. Canonical API contract

The implemented route follows the active catalogue convention:

GET /api/v1/catalog/anime/:slug/episodes/:episodeNumber/playback

The earlier proposed /episodes/:episodeId/playback route is superseded by this slug/episode-number route. It returns an episode descriptor, available first-party sources and supported subtitle tracks.

## 3. Eligibility and integrity controls

The query requires:
- The requested episode to be PUBLISHED.
- Its anime to be PUBLISHED.
- Video associations to reference READY VIDEO assets with supported video MIME types.
- Subtitle associations to reference READY SUBTITLE assets with supported subtitle MIME types and VTT/SRT formats.
- Subtitle format and MIME type to agree (VTT maps to direct WebVTT delivery; SRT maps to the conversion endpoint).

Before metadata is returned, the backend checks each candidate's managed storage file and verifies its actual byte size against database metadata. Missing, malformed, unavailable, wrong-size or format/MIME-mismatched assets are omitted.

Only first-party media URLs are returned. Storage keys and absolute filesystem paths remain server-side. Playback metadata uses no-store caching.

## 4. Tests and evidence

A dedicated catalogue playback route test covers:
- Published episode/anime query conditions.
- READY state, media kind and supported MIME filters.
- A present video source.
- Missing video exclusion.
- Present VTT subtitle.
- SRT size-mismatch exclusion.
- Subtitle format/MIME mismatch exclusion.
- Invalid episode number and missing/unpublished episode behavior.
- No storage path/key disclosure.

The media delivery tests separately cover direct VTT and SRT conversion.

CI run 44738805397 passed all active-workspace gates: Prisma validation/migrations/seeding, lint, typecheck, backend tests, frontend smoke/accessibility tests and production builds.

## 5. Scope not yet complete

This acceptance does **not** complete overall Checkpoint 3.5. The following remain open:
- Kuhi integration in the active Express/TypeScript runtime.
- Review and clean-room rewrite or licensing verification for the Anivexa provider adapters.
- Server-managed AniList identity mapping on the local Anime record.
- Provider search/resolution contracts and provider-health/fallback policy.
- Opaque, session-bound media resource handles; raw upstream URLs/referers must not be accepted from clients.
- SSRF-safe provider/media fetch controls and redirect/DNS validation.
- Per-client and provider rate limiting.
- Integration tests for provider resolution, session binding and failure isolation.

The active React/Vite frontend still has no watch route and does not consume this API. That remains Checkpoint 3.6.

## 6. Repository boundary

Anime-streaming is a read-only reference. No changes were made to it.

**Checkpoint 3.5A accepted. Overall Checkpoint 3.5 remains open.**
