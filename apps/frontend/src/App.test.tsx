import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { apiClient } from "@samren/api-client";

function renderApp(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("frontend foundation", () => {
  it("renders the home page and accessible primary navigation", () => {
    vi.spyOn(apiClient, "health").mockResolvedValue({
      status: "ok",
      service: "samren-api",
      timestamp: new Date().toISOString(),
    });

    vi.spyOn(apiClient, "catalogAnime").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 6, totalItems: 0, totalPages: 0 } });

    renderApp();

    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /discover/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /my library/i })).toBeTruthy();
  });

  it("reports the API connection only after a successful health response", async () => {
    vi.spyOn(apiClient, "health").mockResolvedValue({
      status: "ok",
      service: "samren-api",
      timestamp: new Date().toISOString(),
    });

    vi.spyOn(apiClient, "catalogAnime").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 6, totalItems: 0, totalPages: 0 } });

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "API status: connected" })).toBeTruthy();
    });
  });

  it("renders the database-backed browse filters and catalogue empty state", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "catalogGenres").mockResolvedValue([]);
    vi.spyOn(apiClient, "catalogStudios").mockResolvedValue([]);
    vi.spyOn(apiClient, "catalogAnime").mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 },
    });

    renderApp("/browse");

    expect(screen.getByRole("heading", { name: /browse the catalogue/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Search titles" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText(/no titles match those filters/i)).toBeTruthy();
    });
  });
});

describe("administrator workspace", () => {
  it("shows a secure sign-in form when no session exists", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "authSession").mockRejectedValue(new Error("Authentication is required"));

    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: /administrator sign in/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Email address" })).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("loads the protected catalogue manager for an administrator", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "authSession").mockResolvedValue({
      user: { id: "admin-1", email: "admin@samren.test", username: "admin", role: "ADMIN" },
    });
    vi.spyOn(apiClient, "adminCatalogAnime").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "adminCatalogGenres").mockResolvedValue([]);
    vi.spyOn(apiClient, "adminCatalogStudios").mockResolvedValue([]);
    vi.spyOn(apiClient, "adminCatalogSeasons").mockResolvedValue([]);
    vi.spyOn(apiClient, "adminCatalogAssets").mockResolvedValue([]);

    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: /catalogue management/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /create a catalogue draft/i })).toBeTruthy();
    expect(await screen.findByText(/no catalogue records exist yet/i)).toBeTruthy();
  });


  it("lets an administrator edit first-party catalogue metadata", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "authSession").mockResolvedValue({
      user: { id: "admin-1", email: "admin@samren.test", username: "admin", role: "ADMIN" },
    });
    const item = {
      id: "anime-1",
      slug: "clockwork-orbit",
      title: "The Clockwork Orbit",
      englishTitle: null,
      nativeTitle: null,
      synopsis: "A story about maps.",
      type: "TV" as const,
      releaseStatus: "FINISHED" as const,
      publicationStatus: "DRAFT" as const,
      releaseYear: 2025,
      releaseSeason: "FALL" as const,
      ageRating: "PG_13" as const,
      score: 82,
      featured: false,
      posterAssetId: null,
      bannerAssetId: null,
      publishedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      genres: [{ genre: { id: "genre-1", slug: "adventure", name: "Adventure" } }],
      studios: [{ studio: { id: "studio-1", slug: "samren-studio", name: "Samren Studio" } }],
      _count: { episodes: 0 },
    };
    vi.spyOn(apiClient, "adminCatalogAnime").mockResolvedValue({ items: [item] });
    vi.spyOn(apiClient, "adminCatalogGenres").mockResolvedValue([{ id: "genre-1", slug: "adventure", name: "Adventure" }]);
    vi.spyOn(apiClient, "adminCatalogStudios").mockResolvedValue([{ id: "studio-1", slug: "samren-studio", name: "Samren Studio" }]);
    vi.spyOn(apiClient, "adminCatalogSeasons").mockResolvedValue([]);
    const update = vi.spyOn(apiClient, "adminUpdateAnime").mockResolvedValue({ ...item, title: "Clockwork Orbit Revisited" });
    vi.spyOn(apiClient, "adminCatalogEpisodes").mockResolvedValue([]);
    vi.spyOn(apiClient, "adminCatalogAssets").mockResolvedValue([]);
    const createEpisode = vi.spyOn(apiClient, "adminCreateEpisode").mockResolvedValue({
      id: "episode-1", animeId: "anime-1", seasonId: null, episodeNumber: 1, absoluteNumber: null,
      title: "A New Beginning", synopsis: null, durationSeconds: null, airDate: null,
      publicationStatus: "DRAFT", isFiller: false, isRecap: false,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    });

    renderApp("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Edit The Clockwork Orbit" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Clockwork Orbit Revisited" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith("anime-1", expect.objectContaining({
        title: "Clockwork Orbit Revisited",
        slug: "clockwork-orbit",
        genreSlugs: ["adventure"],
        studioSlugs: ["samren-studio"],
      }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Episodes" }));
    expect(await screen.findByRole("heading", { name: "Manage episodes" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Episode title"), { target: { value: "A New Beginning" } });
    fireEvent.click(screen.getByRole("button", { name: "Add episode draft" }));
    await waitFor(() => {
      expect(createEpisode).toHaveBeenCalledWith(expect.objectContaining({
        animeId: "anime-1",
        episodeNumber: 1,
        title: "A New Beginning",
        publicationStatus: "DRAFT",
      }));
    });
  });


  it("lets administrators create taxonomy records and register first-party asset metadata", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "authSession").mockResolvedValue({
      user: { id: "admin-1", email: "admin@samren.test", username: "admin", role: "ADMIN" },
    });
    vi.spyOn(apiClient, "adminCatalogAnime").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "adminCatalogGenres").mockResolvedValue([]);
    vi.spyOn(apiClient, "adminCatalogStudios").mockResolvedValue([]);
    vi.spyOn(apiClient, "adminCatalogSeasons").mockResolvedValue([]);
    vi.spyOn(apiClient, "adminCatalogAssets").mockResolvedValue([]);
    const createGenre = vi.spyOn(apiClient, "adminCreateGenre").mockResolvedValue({ id: "genre-2", slug: "mystery", name: "Mystery" });
    const createStudio = vi.spyOn(apiClient, "adminCreateStudio").mockResolvedValue({ id: "studio-2", slug: "new-studio", name: "New Studio" });
    const createSeason = vi.spyOn(apiClient, "adminCreateSeason").mockResolvedValue({ id: "season-2", year: 2026, season: "WINTER", label: "Winter 2026" });
    const createAsset = vi.spyOn(apiClient, "adminCreateAsset").mockResolvedValue({
      id: "asset-2", storageKey: "catalogue/posters/sample.webp", originalFilename: "sample.webp",
      mediaKind: "POSTER", mimeType: "image/webp", sizeBytes: "2048", checksumSha256: null,
      processingState: "PENDING", width: null, height: null, durationSeconds: null,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    });

    renderApp("/admin");

    fireEvent.change(await screen.findByLabelText("Genre name"), { target: { value: "Mystery" } });
    fireEvent.click(screen.getByRole("button", { name: "Add genre" }));
    fireEvent.change(screen.getByLabelText("Studio name"), { target: { value: "New Studio" } });
    fireEvent.click(screen.getByRole("button", { name: "Add studio" }));
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Add season" }));
    fireEvent.change(screen.getByLabelText("Internal storage key"), { target: { value: "catalogue/posters/sample.webp" } });
    fireEvent.change(screen.getByLabelText("Original filename"), { target: { value: "sample.webp" } });
    fireEvent.change(screen.getByLabelText("Size (bytes)"), { target: { value: "2048" } });
    fireEvent.click(screen.getByRole("button", { name: "Register metadata" }));

    await waitFor(() => {
      expect(createGenre).toHaveBeenCalledWith({ slug: "mystery", name: "Mystery" });
      expect(createStudio).toHaveBeenCalledWith({ slug: "new-studio", name: "New Studio" });
      expect(createSeason).toHaveBeenCalledWith({ year: 2026, season: "WINTER", label: null });
      expect(createAsset).toHaveBeenCalledWith(expect.objectContaining({
        storageKey: "catalogue/posters/sample.webp",
        originalFilename: "sample.webp",
        mediaKind: "POSTER",
        mimeType: "image/webp",
        sizeBytes: 2048,
      }));
    });
  });

  it("does not render catalogue write controls for a regular user", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "authSession").mockResolvedValue({
      user: { id: "user-1", email: "user@samren.test", username: "user", role: "USER" },
    });

    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: /administrator access required/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create draft/i })).toBeNull();
  });
});


describe("first-party watch experience", () => {
  it("lets viewers switch between available video qualities", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "catalogPlayback").mockResolvedValue({
      episode: { id: "episode-1", episodeNumber: 1, title: "Pilot", synopsis: null, durationSeconds: 1200 },
      sources: [
        { id: "source-sd", qualityLabel: "480p", isDefault: true, mimeType: "video/mp4", url: "/api/v1/media/asset-sd" },
        { id: "source-hd", qualityLabel: "1080p", isDefault: false, mimeType: "video/mp4", url: "/api/v1/media/asset-hd" },
      ],
      subtitles: [],
    });
    vi.spyOn(apiClient, "catalogAnimeBySlug").mockResolvedValue({
      episodes: [{ id: "episode-1", episodeNumber: 1, title: "Pilot" }],
    } as never);

    renderApp("/watch/the-clockwork-orbit/1");

    const quality = await screen.findByLabelText("Video quality") as HTMLSelectElement;
    expect(quality.value).toBe("source-sd");
    fireEvent.change(quality, { target: { value: "source-hd" } });

    await waitFor(() => {
      expect(quality.value).toBe("source-hd");
      expect(document.querySelector("video")?.getAttribute("src")).toBe("/api/v1/media/asset-hd");
    });
  });

  it("starts provider playback after a media error and switches provider when the fallback also errors", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "catalogPlayback").mockResolvedValue({
      episode: { id: "episode-1", episodeNumber: 4, title: "Pilot", synopsis: null, durationSeconds: 1200 },
      sources: [{ id: "source-local", qualityLabel: "1080p", isDefault: true, mimeType: "video/mp4", url: "/api/v1/media/local" }],
      subtitles: [],
    });
    vi.spyOn(apiClient, "catalogAnimeBySlug").mockResolvedValue({ episodes: [] } as never);
    const aggregate = vi.spyOn(apiClient, "aggregatePlayback").mockResolvedValue({
      sessionId: "session-1",
      stream: { provider: "animegg", url: "https://cdn.example.test/first.mp4", type: "mp4", server: "main", quality: "1080p", audio: "sub" },
      providers: 11,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const fallback = vi.spyOn(apiClient, "fallbackPlayback").mockResolvedValue({
      stream: { provider: "anizone", url: "https://cdn.example.test/second.mp4", type: "mp4", server: "backup", quality: "720p", audio: "sub" },
      tried: ["animegg", "anizone"],
      remaining: 9,
    });

    renderApp("/watch/the-clockwork-orbit/4");
    const idInput = await screen.findByLabelText("AniList ID for provider fallback");
    fireEvent.change(idInput, { target: { value: "12345" } });
    fireEvent.error(document.querySelector("video")!);

    await waitFor(() => {
      expect(aggregate).toHaveBeenCalledWith(12345, 4, "sub");
      expect(document.querySelector("video")?.getAttribute("src")).toBe("https://cdn.example.test/first.mp4");
    });

    fireEvent.error(document.querySelector("video")!);
    await waitFor(() => {
      expect(fallback).toHaveBeenCalledWith("session-1", "animegg");
      expect(document.querySelector("video")?.getAttribute("src")).toBe("https://cdn.example.test/second.mp4");
    });
  });

});
