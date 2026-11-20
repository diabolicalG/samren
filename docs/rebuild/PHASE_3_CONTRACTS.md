# Samren Phase 3 — Contracts and Implementation Decisions

**Checkpoint:** 3.1 — Contracts and branch reconciliation  
**Date:** 2026-11-20  
**Implementation branch:** `phase-3-media-providers`  
**Scope authority:** user-approved Phase 3 Option B amendment dated 2026-11-15, reaffirmed 2026-11-20.

## 1. Repository and phase boundaries

- All implementation changes are made in `diabolicalG/samren`.
- `diabolicalG/Anime-streaming` is a read-only architecture/reference repository. It may be inspected for API contracts, provider behavior and patterns; it must never be modified.
- Phase 1 and Phase 2 remain frozen. The active runtime is the React/Vite frontend and Express/TypeScript backend in the pnpm workspace.
- The older `apps/api` Python gateway is legacy and is not a Phase 3 implementation target.
- Phase 3 includes first-party local media and the user-approved Kuhi/Anivexa provider integration. First-party assets and transient provider streams remain separate.
- Phase 4 accounts, server-side history, watchlists, favourites, downloads and cross-device progress remain deferred.

The user-approved provider amendment supersedes the original first-party-only exclusions. It does not authorize arbitrary proxying, unsafe source reuse, provider credentials in the browser, or changes to the reference repository.

## 2. Local catalogue identity and provider mapping

### Decision

Add an optional, administrator-managed AniList identity to the existing Samren `Anime` record:

- Prisma field: `aniListId Int? @unique`.
- Accept only positive safe integers within the AniList ID range.
- Null means no provider mapping; multiple unmapped anime records remain valid.
- The field is editable only through ADMIN-protected catalogue routes and the admin UI.
- Add a forward-only Phase 3 Prisma migration. Do not rewrite Phase 2 migrations or fixtures.
- Include the mapping in the internal playback service contract. Do not expose it in public catalogue responses unless a specific UI need is demonstrated.

Do not infer or silently persist an AniList mapping from title alone. An administrator must confirm the match. Any future assisted search must show the candidate title/year/format and a confidence score before saving.

### Provider playback request

The browser identifies a Samren catalogue episode, not an external provider ID:

`POST /api/v1/provider-playback/sessions`

Request body:

```json
{
  "animeSlug": "samren-catalogue-slug",
  "episodeNumber": 3,
  "audio": "sub"
}
```

The backend must:
1. Resolve a published Samren anime and published episode.
2. Read the administrator-verified AniList ID from that anime.
3. Return `409 PROVIDER_MAPPING_MISSING` if no mapping exists.
4. Resolve providers server-side. Never trust a browser-supplied AniList ID, provider URL, provider episode ID or referer.
5. Return only normalized source metadata and opaque same-origin media handles.

## 3. Provider resource and playback-session contract

### No caller-selected upstream destinations

The existing `?url=` / `?referer=` media relay contract is retired. Host allowlisting alone is not sufficient because it still lets a caller select arbitrary paths on configured hosts.

Use a server-owned playback session and resource registry:

- Session IDs and resource IDs are cryptographically random opaque identifiers.
- A resource record stores the exact upstream URL, allowed media kind, provider session, server-side referer/headers, expiry and (where needed) a validated manifest template.
- The browser receives only same-origin URLs containing opaque identifiers. It never receives raw provider URLs, referers, cookies or private headers.
- A resource can be registered only by a provider adapter after validating its source, or by the server's HLS/DASH parser when discovering a child URI from an already-authorized manifest.
- A request for an unknown, expired, revoked or cross-session resource is rejected before any upstream network request.
- The resource handler revalidates HTTPS, hostname allowlist, port policy, DNS/IP safety and redirect targets before fetching.
- No endpoint accepts an arbitrary URL, redirect target or referer from the browser.

### HLS and DASH

- HLS root manifests, variant playlists, keys, subtitle resources and segments are registered server-side and rewritten to opaque same-origin resource handles.
- DASH BaseURL, SegmentURL, Location and SegmentTemplate resources are registered as constrained server-side templates. Any template substitutions are parsed and validated against the registered template; they cannot introduce a new host or path.
- Manifest size, segment size, response time and redirect count remain bounded.
- GET, HEAD and Range are forwarded only to an already-registered resource.
- Provider referers and request headers remain server-side.
- The resource registry is in-process for the initial single-process deployment. Session close/expiry must revoke its resources and cancel outstanding work. Do not claim multi-instance support.

### Session lifecycle

- Idle session expiry target: 15 minutes.
- Absolute session lifetime target: 60 minutes.
- Session close revokes all associated resources and aborts queued/in-flight provider tasks where supported.
- Expired sessions are pruned with a bounded cleanup strategy.
- These values must be configurable and covered by fake-clock tests.

## 4. Provider integration boundaries

### Kuhi

The Anime-streaming reference contains:
- A TypeScript `KuhiProvider` client contract.
- A Kuhi API v3 service source under `apps/kuhi-api` with an MIT license.
- A Git submodule at `services/kuhi` whose canonical source URL is not available from the inspected repository metadata.

**Decision:** use the TypeScript client contract as the integration reference and the accessible MIT-licensed Kuhi API v3 source only where needed. The submodule must not be copied or guessed.

The service is to be introduced into Samren as a new, isolated `services/kuhi-api` component, not as changes to the legacy `apps/api` gateway. It is an optional local service, bound to loopback by default, and called only by the active Express backend through a typed Kuhi client.

Expose only the provider operations required by Samren:
- Search/suggestions for administrator mapping assistance.
- Episode/provider discovery for a verified AniList ID.
- Sub/dub stream extraction for the mapped episode.

Do **not** copy the Kuhi demo HTML, wildcard CORS, `/proxy_m3u8`, `/proxy_segment` or any endpoint that accepts arbitrary client-supplied URLs. Kuhi extraction results must pass Samren's URL/host validation and opaque-resource relay before reaching the browser. Keep the MIT LICENSE and attribution notice with the service source.

Proposed settings:
- `KUHI_ENABLED=false` by default.
- `KUHI_BASE_URL=http://127.0.0.1:8100` for local development.
- Explicit provider and stream host allowlists in the Kuhi service.
- Bounded connect/read timeouts, response sizes and concurrency.
- No browser-facing access to the Kuhi service.

The service README describes Kuhi as experimental and not guaranteed to be reliable. Treat provider failure as an ordinary recoverable condition.

### Anivexa

- Anivexa adapters remain native to the active Samren TypeScript backend; no separately operated Anivexa API is introduced.
- Anivexa remains disabled by default.
- API/site and media/CDN host allowlists are separate, explicit and fail closed.
- Use safe HTTPS transport, DNS/IP validation, redirect revalidation, bounded responses and timeouts.
- Never use shell execution, dynamic provider-script execution, hard-coded credentials, browser impersonation or private provider headers.
- Provider availability is not guaranteed. Provider registration is not evidence of live playback.

**Source-provenance decision:** the inspected Anivexa reference/upstream paths did not expose a license file. Three current Samren files were measured as 100% matching non-empty source lines to the reference Anivexa files: `providers/animegg.js`, `core/new-provider-utils.js` and `extractors/vidplay.js`. These copied files must not be treated as cleared for distribution. Replace copied/unlicensed modules with clean-room implementations based on public behavior and protocol contracts, or obtain and record an applicable license/permission before retaining them. Preserve independent code and required notices. Do not claim the current provider set is license-cleared.

## 5. Rate-limit contract

Add bounded per-client throttling to the provider API. Initial configurable defaults:

| Operation | Initial limit |
|---|---:|
| Provider search/discovery | 30 requests per minute per client |
| Playback session creation | 5 sessions per 5 minutes per client |
| Fallback selection | 20 requests per minute per session |
| Registered media-resource requests | 900 requests per minute per session |

- Return HTTP 429 with a safe, stable error envelope and `Retry-After`.
- Use bounded storage for rate-limit keys and prune stale entries.
- Keep resource requests sufficiently generous for HLS/DASH segment traffic.
- Process-local limits are defense in depth only. A multi-instance production deployment also requires shared edge/reverse-proxy rate limiting.
- Do not add Redis solely for this phase unless a concrete multi-instance requirement is approved.

## 6. Upload and storage configuration contract

- `MEDIA_STORAGE_ROOT`: relative `.data/media` default for development only. Production must explicitly set an absolute persistent path outside public web roots and outside ephemeral deployment directories.
- Per-kind maximum upload sizes must be validated configuration, not duplicated hard-coded values:
  - Images: 15 MiB.
  - Video: 2 GiB.
  - Subtitles: 2 MiB.
- The same values must be used by frontend preflight and backend enforcement.
- Upload request timeout and disconnect cleanup must be explicit.
- The ADMIN status endpoint must return safe asset metadata/state only; never a storage key or absolute path.
- Database metadata and the media directory must both be included in any backup/restore procedure.

## 7. Subtitle and codec contract

- First-party browser-native subtitle baseline is WebVTT.
- SRT may be converted only through a maintained parser/converter with cue/timestamp validation.
- ASS is unsupported unless a safe conversion path is implemented and tested; do not advertise it as playable by default.
- Provider subtitle tracks must be verified as WebVTT or converted from a supported format before they are attached to a native video `track`.
- MP4/WebM signature detection does not prove codec compatibility. Do not claim a container is universally playable; document tested codecs and show clear unsupported-media states.
- No first-party FFmpeg transcoding, HLS packaging or adaptive-bitrate generation in this phase. Provider HLS/DASH is a separate, allowlisted playback path.

## 8. Frontend playback and progress

- The watch route uses the Samren slug/episode identity and backend playback contracts.
- Remove manual AniList ID entry from the viewer experience.
- Keep provider selection/fallback distinct from first-party media selection.
- Guard browser-local progress reads/writes against disabled storage, quota errors, malformed values and invalid duration; progress remains local-only in Phase 3.
- Vendor HLS.js/dash.js as pinned workspace dependencies with lazy loading, or provide an explicit integrity policy. Do not rely on unverified CDN script execution.
- Add real-browser E2E coverage in CI. jsdom component tests remain useful but are not sufficient playback evidence.

## 9. Checkpoint 3.1 exit checklist

- [x] Phase 3 readiness audit committed.
- [x] Feature branch reconciled with current Samren main; zero commits behind.
- [x] Phase 3-only changes to legacy `apps/api` restored/removed from the feature diff.
- [x] Root README describes the active runtime.
- [x] Backend CORS example matches Vite's 5173 origin.
- [x] Anime-streaming remains read-only.
- [x] User-approved Kuhi/Anivexa scope recorded.
- [x] AniList mapping, opaque media resource, rate-limit and upload configuration contracts defined.
- [x] Kuhi service boundary defined without copying its open proxy/CORS demo.
- [x] Anivexa clean-room/licensing rule recorded.
- [x] CI run for reconciliation commit `99977f0600b6ecab56db39bdff9ea77f0b30af09` completed successfully (run `44735651560`).
- [x] Progress and provider-audit documents are updated to reflect the reconciled active-runtime design.

**Checkpoint 3.1 accepted on 2026-11-20.** Reconciliation CI run `44735651560` passed all active-workspace gates; the legacy Python API test step is no longer part of the Phase 3 workflow. The progress, provider and readiness audit documents are aligned. Proceed to Checkpoint 3.2 only, then audit it before moving forward.


## 9. First-party delivery and playback route reconciliation — 2026-11-20

The canonical first-party playback metadata route follows the active catalogue route convention:

GET /api/v1/catalog/anime/:slug/episodes/:episodeNumber/playback

It returns only sources/subtitles attached to a published episode under a published anime, with READY state, correct media kind, supported MIME/format pairing and verified managed-file existence/size. It returns first-party media URLs only; storage keys and absolute paths remain server-side.

Public asset delivery is through GET/HEAD /api/v1/media/:assetId; SRT subtitle conversion is through GET/HEAD /api/v1/media/:assetId/vtt. The generic route permits published poster/banner, video and VTT subtitle associations only. SRT tracks use the conversion route. Single byte ranges are supported; multi-range requests are intentionally unsupported.

**Implementation status:** first-party delivery (Checkpoint 3.4) and the first-party playback metadata/subtitle API (Checkpoint 3.5A) are accepted. This does not implement the active frontend watch route and does not complete provider integration. Kuhi, clean-room/licensed Anivexa adapters, AniList identity mapping, opaque session-bound provider resource handles and per-client rate limiting remain outstanding within Checkpoint 3.5. The active frontend watch/player remains Checkpoint 3.6.
