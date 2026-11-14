import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Compass, Library, Search, Sparkles, SlidersHorizontal } from "lucide-react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import type { AdminAnimeWriteInput, CatalogAnimeCard, CatalogAnimeDetail, CatalogListParams } from "@samren/types";
import { apiClient } from "@samren/api-client";
import { ActionLink, StatusBadge, Surface, TextField } from "./components/ui";

function formatLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AnimeCard({ anime }: { anime: CatalogAnimeCard }) {
  return (
    <Link className="anime-card-link" to={`/anime/${anime.slug}`}>
      <article className="anime-card">
        <div className="anime-poster" aria-hidden="true">
          <span className="poster-mark"><Clapperboard size={24} strokeWidth={1.3} /></span>
          {anime.featured ? <span className="poster-featured">FEATURED</span> : null}
          <span className="poster-year">{anime.releaseYear ?? "—"}</span>
        </div>
        <div className="anime-card-copy">
          <div className="anime-card-meta"><span>{formatLabel(anime.type)}</span>{anime.score !== null ? <span className="anime-score">✦ {anime.score}</span> : null}</div>
          <h3>{anime.title}</h3>
          <p>{anime.genres.slice(0, 2).map(({ genre }) => genre.name).join(" · ") || formatLabel(anime.releaseStatus)}</p>
        </div>
      </article>
    </Link>
  );
}

function AnimeGrid({ items }: { items: CatalogAnimeCard[] }) {
  return <div className="anime-grid">{items.map((anime) => <AnimeCard key={anime.id} anime={anime} />)}</div>;
}

function CatalogSection({ title, eyebrow, items, empty }: { title: string; eyebrow: string; items: CatalogAnimeCard[]; empty: string }) {
  return (
    <section className="catalog-section">
      <div className="catalog-section-heading"><div><span className="section-kicker">{eyebrow}</span><h2>{title}</h2></div><Link className="text-link" to="/browse">View catalogue ↗</Link></div>
      {items.length ? <AnimeGrid items={items} /> : <Surface className="catalog-empty"><p>{empty}</p></Surface>}
    </section>
  );
}

function HomePage() {
  const featuredQuery = useQuery({
    queryKey: ["catalog", "featured"],
    queryFn: () => apiClient.catalogAnime({ featured: true, pageSize: 6, sort: "score" }),
  });
  const recentQuery = useQuery({
    queryKey: ["catalog", "recent"],
    queryFn: () => apiClient.catalogAnime({ pageSize: 6, sort: "recent" }),
  });

  return (
    <main className="page-shell">
      <section className="hero-panel" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={14} /> YOUR ANIME SPACE</span>
          <h1 id="hero-title">A quieter way<br />to <span>find your next</span><br />favorite story.</h1>
          <p>Build your own collection, keep track of every episode, and make your watchlist feel like home.</p>
          <ActionLink className="primary-action" to="/browse">Explore the catalogue <span aria-hidden="true">↗</span></ActionLink>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" />
          <div className="orbit-core"><Clapperboard size={42} strokeWidth={1.2} /></div>
          <span className="orbit-star star-one">✦</span><span className="orbit-star star-two">✧</span>
        </div>
        <div className="hero-index"><span>01</span><span className="index-line" /><span>YOUR OWN COLLECTION</span></div>
      </section>
      {featuredQuery.isLoading ? <section className="catalog-section"><div className="catalog-section-heading"><h2>Featured collection</h2></div><div className="catalog-loading">Loading the catalogue…</div></section> : null}
      {featuredQuery.isError ? <Surface className="catalog-empty" role="alert"><p>Featured catalogue items could not be loaded. Please try again later.</p></Surface> : null}
      {!featuredQuery.isLoading && !featuredQuery.isError ? <CatalogSection title="Featured collection" eyebrow="HANDPICKED IN SAMREN" items={featuredQuery.data?.items ?? []} empty="No featured titles have been published yet." /> : null}
      {recentQuery.isLoading ? <section className="catalog-section"><div className="catalog-section-heading"><h2>Recently added</h2></div><div className="catalog-loading">Loading recent additions…</div></section> : null}
      {recentQuery.isError ? <Surface className="catalog-empty" role="alert"><p>Recent catalogue items could not be loaded.</p></Surface> : null}
      {!recentQuery.isLoading && !recentQuery.isError ? <CatalogSection title="Recently added" eyebrow="FRESHLY CATALOGUED" items={recentQuery.data?.items ?? []} empty="New catalogue entries will appear here when published." /> : null}
    </main>
  );
}

function BrowsePage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [genre, setGenre] = useState("");
  const [studio, setStudio] = useState("");
  const [year, setYear] = useState("");
  const [season, setSeason] = useState("");
  const [sort, setSort] = useState("title");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const genresQuery = useQuery({ queryKey: ["catalog", "genres"], queryFn: apiClient.catalogGenres });
  const studiosQuery = useQuery({ queryKey: ["catalog", "studios"], queryFn: apiClient.catalogStudios });
  const params: CatalogListParams = {
    q: deferredSearch.trim() || undefined,
    type: type ? type as CatalogListParams["type"] : undefined,
    status: status ? status as CatalogListParams["status"] : undefined,
    genre: genre || undefined,
    studio: studio || undefined,
    year: year.length === 4 ? Number(year) : undefined,
    season: season ? season as CatalogListParams["season"] : undefined,
    page,
    pageSize: 24,
    sort: sort as CatalogListParams["sort"],
  };
  const catalogQuery = useQuery({
    queryKey: ["catalog", "browse", params],
    queryFn: () => apiClient.catalogAnime(params),
    placeholderData: (previousData) => previousData,
  });

  return (
    <main className="page-shell browse-page">
      <section className="browse-heading"><span className="section-kicker">DISCOVER SOMETHING NEW</span><h1>Browse <span>the catalogue.</span></h1><p>Every title here belongs to the Samren catalogue.</p></section>
      <Surface className="catalog-filters">
        <div className="filter-title"><SlidersHorizontal size={16} /><span>Refine your search</span></div>
        <div className="filter-grid">
          <TextField id="catalog-search" label="Search titles" placeholder="Search anime…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          <label className="ui-field" htmlFor="catalog-type">Format<select className="ui-input" id="catalog-type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">All formats</option><option value="TV">TV</option><option value="MOVIE">Movie</option><option value="OVA">OVA</option><option value="ONA">ONA</option><option value="SPECIAL">Special</option></select></label>
          <label className="ui-field" htmlFor="catalog-status">Release status<select className="ui-input" id="catalog-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="AIRING">Airing</option><option value="FINISHED">Finished</option><option value="NOT_YET_AIRED">Upcoming</option><option value="CANCELLED">Cancelled</option></select></label>
          <label className="ui-field" htmlFor="catalog-genre">Genre<select className="ui-input" id="catalog-genre" value={genre} onChange={(event) => { setGenre(event.target.value); setPage(1); }}><option value="">All genres</option>{(genresQuery.data ?? []).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
          <TextField id="catalog-year" label="Release year" inputMode="numeric" placeholder="e.g. 2025" value={year} onChange={(event) => { setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4)); setPage(1); }} />
          <label className="ui-field" htmlFor="catalog-season">Season<select className="ui-input" id="catalog-season" value={season} onChange={(event) => { setSeason(event.target.value); setPage(1); }}><option value="">All seasons</option><option value="WINTER">Winter</option><option value="SPRING">Spring</option><option value="SUMMER">Summer</option><option value="FALL">Fall</option></select></label>
          <label className="ui-field" htmlFor="catalog-studio">Studio<select className="ui-input" id="catalog-studio" value={studio} onChange={(event) => { setStudio(event.target.value); setPage(1); }}><option value="">All studios</option>{(studiosQuery.data ?? []).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
          <label className="ui-field" htmlFor="catalog-sort">Sort by<select className="ui-input" id="catalog-sort" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="title">Title</option><option value="recent">Recently added</option><option value="score">Highest score</option></select></label>
        </div>
      </Surface>
      <div className="browse-results-heading"><h2>Catalogue</h2>{catalogQuery.data ? <span>{catalogQuery.data.pagination.totalItems} titles</span> : null}</div>
      {catalogQuery.isLoading ? <div className="catalog-loading" role="status">Loading catalogue…</div> : null}
      {catalogQuery.isError ? <Surface className="catalog-empty" role="alert"><p>The catalogue could not be loaded. Check the API connection and try again.</p></Surface> : null}
      {catalogQuery.isSuccess && catalogQuery.data.items.length === 0 ? <Surface className="catalog-empty"><p>No titles match those filters. Try a different search.</p></Surface> : null}
      {catalogQuery.isSuccess && catalogQuery.data.items.length > 0 ? <><AnimeGrid items={catalogQuery.data.items} /><div className="catalog-pagination"><button type="button" className="ui-button ui-button--secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {catalogQuery.data.pagination.page} of {Math.max(1, catalogQuery.data.pagination.totalPages)}</span><button type="button" className="ui-button ui-button--secondary" disabled={page >= catalogQuery.data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div></> : null}
    </main>
  );
}

function AnimeDetailPage() {
  const { slug = "" } = useParams();
  const animeQuery = useQuery({
    queryKey: ["catalog", "anime", slug],
    queryFn: () => apiClient.catalogAnimeBySlug(slug),
    enabled: Boolean(slug),
  });

  if (animeQuery.isLoading) return <main className="page-shell"><div className="catalog-loading" role="status">Loading anime details…</div></main>;
  if (animeQuery.isError || !animeQuery.data) return <main className="page-shell"><section className="simple-page"><span className="section-kicker">CATALOGUE</span><h1>Title not found.</h1><p>This title may be unpublished or no longer available.</p><Link className="text-link" to="/browse">Return to browse</Link></section></main>;

  const anime: CatalogAnimeDetail = animeQuery.data;
  return (
    <main className="page-shell detail-page">
      <Link className="text-link" to="/browse">← Back to catalogue</Link>
      <section className="detail-hero">
        <div className="detail-art" aria-hidden="true"><Clapperboard size={44} strokeWidth={1.1} /></div>
        <div className="detail-copy">
          <span className="section-kicker">{formatLabel(anime.type)} · {formatLabel(anime.releaseStatus)}</span>
          <h1>{anime.title}</h1>
          {anime.englishTitle && anime.englishTitle !== anime.title ? <p className="detail-alt-title">{anime.englishTitle}</p> : null}
          <div className="detail-facts"><span>{anime.releaseYear ?? "Year unknown"}</span>{anime.releaseSeason ? <span>{formatLabel(anime.releaseSeason)}</span> : null}{anime.ageRating ? <span>{formatLabel(anime.ageRating)}</span> : null}{anime.score !== null ? <span>✦ {anime.score}/100</span> : null}</div>
          <p className="detail-synopsis">{anime.synopsis || "No synopsis has been added yet."}</p>
          <div className="detail-tags">{anime.genres.map(({ genre }) => <span key={genre.id}>{genre.name}</span>)}</div>
          {anime.studios.length ? <p className="detail-studios">Studio: {anime.studios.map(({ studio }) => studio.name).join(", ")}</p> : null}
        </div>
      </section>
      <section className="episode-section">
        <div className="catalog-section-heading"><div><span className="section-kicker">EPISODE GUIDE</span><h2>Episodes</h2></div><span>{anime.episodes.length} published</span></div>
        {anime.episodes.length ? <div className="episode-list">{anime.episodes.map((episode) => <article className="episode-row" key={episode.id}><span className="episode-number">{String(episode.episodeNumber).padStart(2, "0")}</span><div><h3>{episode.title}</h3>{episode.synopsis ? <p>{episode.synopsis}</p> : null}</div><span className="episode-duration">{episode.durationSeconds ? `${Math.round(episode.durationSeconds / 60)} min` : "—"}</span></article>)}</div> : <Surface className="catalog-empty"><p>Episodes have not been published for this title yet.</p></Surface>}
        <p className="playback-note">First-party playback is introduced in Phase 3. This catalogue does not link to third-party streams.</p>
      </section>
    </main>
  );
}


function AdminPage() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
    queryFn: apiClient.authSession,
    retry: false,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSynopsis, setEditSynopsis] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editGenreSlugs, setEditGenreSlugs] = useState<string[]>([]);
  const [editStudioSlugs, setEditStudioSlugs] = useState<string[]>([]);
  const [genreName, setGenreName] = useState("");
  const [genreSlug, setGenreSlug] = useState("");
  const [studioName, setStudioName] = useState("");
  const [studioSlug, setStudioSlug] = useState("");
  const [seasonYear, setSeasonYear] = useState("2026");
  const [seasonName, setSeasonName] = useState<"WINTER" | "SPRING" | "SUMMER" | "FALL">("WINTER");
  const [seasonLabel, setSeasonLabel] = useState("");
  const [activeEpisodeAnimeId, setActiveEpisodeAnimeId] = useState<string | null>(null);
  const [newEpisodeNumber, setNewEpisodeNumber] = useState("1");
  const [newEpisodeTitle, setNewEpisodeTitle] = useState("");
  const [newEpisodeDuration, setNewEpisodeDuration] = useState("");
  const [editPosterAssetId, setEditPosterAssetId] = useState("");
  const [editBannerAssetId, setEditBannerAssetId] = useState("");
  const [assetStorageKey, setAssetStorageKey] = useState("");
  const [assetFilename, setAssetFilename] = useState("");
  const [assetKind, setAssetKind] = useState<"POSTER" | "BANNER" | "VIDEO" | "SUBTITLE">("POSTER");
  const [assetMimeType, setAssetMimeType] = useState("image/webp");
  const [assetSizeBytes, setAssetSizeBytes] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const loginMutation = useMutation({
    mutationFn: () => apiClient.authLogin(email, password),
    onSuccess: async () => {
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
  });
  const logoutMutation = useMutation({
    mutationFn: apiClient.authLogout,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["admin", "catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
  });
  const isAdmin = sessionQuery.data?.user.role === "ADMIN";
  const adminGenresQuery = useQuery({ queryKey: ["admin", "genres"], queryFn: apiClient.adminCatalogGenres, enabled: isAdmin });
  const adminStudiosQuery = useQuery({ queryKey: ["admin", "studios"], queryFn: apiClient.adminCatalogStudios, enabled: isAdmin });
  const adminSeasonsQuery = useQuery({ queryKey: ["admin", "seasons"], queryFn: apiClient.adminCatalogSeasons, enabled: isAdmin });
  const adminEpisodesQuery = useQuery({ queryKey: ["admin", "episodes", activeEpisodeAnimeId], queryFn: () => apiClient.adminCatalogEpisodes(activeEpisodeAnimeId ?? ""), enabled: isAdmin && Boolean(activeEpisodeAnimeId) });
  const adminAssetsQuery = useQuery({ queryKey: ["admin", "assets"], queryFn: apiClient.adminCatalogAssets, enabled: isAdmin });
  const catalogQuery = useQuery({
    queryKey: ["admin", "catalog"],
    queryFn: apiClient.adminCatalogAnime,
    enabled: isAdmin,
    retry: false,
  });
  const createMutation = useMutation({
    mutationFn: () => apiClient.adminCreateAnime({
      title: title.trim(),
      ...(slug.trim() ? { slug: slug.trim() } : {}),
      ...(synopsis.trim() ? { synopsis: synopsis.trim() } : {}),
    }),
    onSuccess: async () => {
      setTitle("");
      setSlug("");
      setSynopsis("");
      setFormMessage("Draft created successfully.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] });
    },
    onError: (error) => setFormMessage(error instanceof Error ? error.message : "The draft could not be created."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, publicationStatus }: { id: string; publicationStatus: "DRAFT" | "PUBLISHED" }) =>
      apiClient.adminUpdateAnime(id, { publicationStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] }),
  });
  const archiveMutation = useMutation({
    mutationFn: apiClient.adminArchiveAnime,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] }),
  });
  const editMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminAnimeWriteInput }) => apiClient.adminUpdateAnime(id, input),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] });
    },
  });
  const createGenreMutation = useMutation({
    mutationFn: () => apiClient.adminCreateGenre({ slug: genreSlug.trim(), name: genreName.trim() }),
    onSuccess: async () => { setGenreName(""); setGenreSlug(""); await queryClient.invalidateQueries({ queryKey: ["admin", "genres"] }); },
  });
  const createStudioMutation = useMutation({
    mutationFn: () => apiClient.adminCreateStudio({ slug: studioSlug.trim(), name: studioName.trim() }),
    onSuccess: async () => { setStudioName(""); setStudioSlug(""); await queryClient.invalidateQueries({ queryKey: ["admin", "studios"] }); },
  });
  const createSeasonMutation = useMutation({
    mutationFn: () => apiClient.adminCreateSeason({ year: Number(seasonYear), season: seasonName, label: seasonLabel.trim() || null }),
    onSuccess: async () => { setSeasonLabel(""); await queryClient.invalidateQueries({ queryKey: ["admin", "seasons"] }); },
  });
  const deleteGenreMutation = useMutation({
    mutationFn: apiClient.adminDeleteGenre,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "genres"] }),
  });
  const deleteStudioMutation = useMutation({
    mutationFn: apiClient.adminDeleteStudio,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "studios"] }),
  });
  const deleteSeasonMutation = useMutation({
    mutationFn: apiClient.adminDeleteSeason,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "seasons"] }),
  });
  const createEpisodeMutation = useMutation({
    mutationFn: () => apiClient.adminCreateEpisode({
      animeId: activeEpisodeAnimeId ?? "",
      episodeNumber: Number(newEpisodeNumber),
      title: newEpisodeTitle.trim(),
      durationSeconds: newEpisodeDuration ? Number(newEpisodeDuration) * 60 : null,
      publicationStatus: "DRAFT",
    }),
    onSuccess: async () => {
      setNewEpisodeTitle("");
      setNewEpisodeNumber(String((Number(newEpisodeNumber) || 0) + 1));
      setNewEpisodeDuration("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "episodes", activeEpisodeAnimeId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] });
    },
  });
  const archiveEpisodeMutation = useMutation({
    mutationFn: apiClient.adminArchiveEpisode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "episodes", activeEpisodeAnimeId] }),
  });
  const updateEpisodeMutation = useMutation({
    mutationFn: ({ id, publicationStatus }: { id: string; publicationStatus: "DRAFT" | "PUBLISHED" }) => apiClient.adminUpdateEpisode(id, { publicationStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "episodes", activeEpisodeAnimeId] }),
  });
  const createAssetMutation = useMutation({
    mutationFn: () => apiClient.adminCreateAsset({
      storageKey: assetStorageKey.trim(),
      originalFilename: assetFilename.trim(),
      mediaKind: assetKind,
      mimeType: assetMimeType.trim(),
      sizeBytes: Number(assetSizeBytes),
    }),
    onSuccess: async () => {
      setAssetStorageKey(""); setAssetFilename(""); setAssetSizeBytes("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "assets"] });
    },
  });
  const deleteAssetMutation = useMutation({
    mutationFn: apiClient.adminDeleteAsset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "assets"] }),
  });

  if (sessionQuery.isLoading) {
    return <main className="page-shell admin-page"><div className="catalog-loading" role="status">Checking administrator session…</div></main>;
  }

  if (!sessionQuery.data) {
    return (
      <main className="page-shell admin-page">
        <section className="admin-heading"><span className="section-kicker">SAMREN CONTROL ROOM</span><h1>Administrator <span>sign in.</span></h1><p>Sign in with the administrator account provisioned for this Samren installation.</p></section>
        <Surface className="admin-login">
          <form onSubmit={(event) => { event.preventDefault(); loginMutation.mutate(); }}>
            <TextField id="admin-email" label="Email address" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <TextField id="admin-password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            {loginMutation.isError ? <p className="admin-error" role="alert">{loginMutation.error.message}</p> : null}
            <button className="ui-button ui-button--primary" type="submit" disabled={loginMutation.isPending}>{loginMutation.isPending ? "Signing in…" : "Sign in securely"}</button>
          </form>
        </Surface>
      </main>
    );
  }

  if (!isAdmin) {
    return <main className="page-shell admin-page"><section className="simple-page"><span className="section-kicker">ACCESS RESTRICTED</span><h1>Administrator access required.</h1><p>This account does not have permission to manage the catalogue.</p><button className="ui-button ui-button--secondary" onClick={() => logoutMutation.mutate()}>Sign out</button></section></main>;
  }

  return (
    <main className="page-shell admin-page">
      <section className="admin-heading">
        <div className="admin-heading-content"><span className="section-kicker">SAMREN CONTROL ROOM</span><h1>Catalogue <span>management.</span></h1><p>Signed in as {sessionQuery.data.user.email}. Changes are written to the first-party catalogue.</p></div>
        <div className="admin-heading-actions"><button className="ui-button ui-button--secondary" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>Sign out</button></div>
      </section>
      <div className="admin-workspace">
        <Surface className="admin-create">
          <span className="section-kicker">NEW ENTRY</span><h2>Create a catalogue draft</h2>
          <form onSubmit={(event) => { event.preventDefault(); setFormMessage(""); createMutation.mutate(); }}>
            <TextField id="admin-anime-title" label="Anime title" required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} />
            <TextField id="admin-anime-slug" label="URL slug (optional)" maxLength={180} placeholder="generated-from-title" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
            <label className="ui-field" htmlFor="admin-anime-synopsis">Synopsis<textarea id="admin-anime-synopsis" className="ui-input admin-textarea" maxLength={10000} rows={4} value={synopsis} onChange={(event) => setSynopsis(event.target.value)} /></label>
            <button className="ui-button ui-button--primary" type="submit" disabled={createMutation.isPending || !title.trim()}>{createMutation.isPending ? "Creating…" : "Create draft"}</button>
            {formMessage ? <p className={createMutation.isError ? "admin-error" : "admin-success"} role="status">{formMessage}</p> : null}
          </form>
        </Surface>
        <section className="admin-records">
          <div className="catalog-section-heading"><div><span className="section-kicker">DATABASE RECORDS</span><h2>All catalogue entries</h2></div><span>{catalogQuery.data?.items.length ?? 0} entries</span></div>
          {catalogQuery.isLoading ? <div className="catalog-loading" role="status">Loading admin catalogue…</div> : null}
          {catalogQuery.isError ? <Surface className="catalog-empty" role="alert"><p>{catalogQuery.error.message}</p></Surface> : null}
          {catalogQuery.data?.items.length === 0 ? <Surface className="catalog-empty"><p>No catalogue records exist yet. Create the first draft.</p></Surface> : null}
          <div className="admin-record-list">
            {catalogQuery.data?.items.map((item) => (
              <div className="admin-record-wrap" key={item.id}>
                <article className="admin-record">
                  <div className="admin-record-copy"><div className="admin-record-meta"><span className={"admin-status admin-status--" + item.publicationStatus.toLowerCase()}>{item.publicationStatus}</span><span>{item._count.episodes} episodes</span></div><h3>{item.title}</h3><p>/{item.slug}</p></div>
                  <div className="admin-record-actions">
                    {item.publicationStatus !== "ARCHIVED" ? <button className="ui-button ui-button--quiet" onClick={() => setActiveEpisodeAnimeId((current) => current === item.id ? null : item.id)} aria-expanded={activeEpisodeAnimeId === item.id}>{activeEpisodeAnimeId === item.id ? "Hide episodes" : "Episodes"}</button>
                    <button className="ui-button ui-button--quiet" onClick={() => { setEditingId(item.id); setEditTitle(item.title); setEditSlug(item.slug); setEditSynopsis(item.synopsis ?? ""); setEditYear(item.releaseYear?.toString() ?? ""); setEditGenreSlugs(item.genres.map(({ genre }) => genre.slug)); setEditStudioSlugs(item.studios.map(({ studio }) => studio.slug)); setEditPosterAssetId(item.posterAssetId ?? ""); setEditBannerAssetId(item.bannerAssetId ?? ""); }} aria-label={"Edit " + item.title}>Edit</button> : null}
                    {item.publicationStatus !== "ARCHIVED" ? <button className="ui-button ui-button--secondary" onClick={() => updateMutation.mutate({ id: item.id, publicationStatus: item.publicationStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED" })} disabled={updateMutation.isPending}>{item.publicationStatus === "PUBLISHED" ? "Unpublish" : "Publish"}</button> : null}
                    {item.publicationStatus !== "ARCHIVED" ? <button className="ui-button ui-button--quiet" onClick={() => archiveMutation.mutate(item.id)} disabled={archiveMutation.isPending}>Archive</button> : null}
                  </div>
                </article>
                {activeEpisodeAnimeId === item.id ? (
                  <Surface className="admin-edit admin-episodes">
                    <div className="catalog-section-heading"><div><span className="section-kicker">EPISODE GUIDE</span><h2>Manage episodes</h2></div><span>{adminEpisodesQuery.data?.length ?? 0} records</span></div>
                    <form onSubmit={(event) => { event.preventDefault(); createEpisodeMutation.mutate(); }}>
                      <TextField id={"episode-number-" + item.id} label="Episode number" required inputMode="numeric" value={newEpisodeNumber} onChange={(event) => setNewEpisodeNumber(event.target.value.replace(/[^0-9]/g, "").slice(0, 5))} />
                      <TextField id={"episode-title-" + item.id} label="Episode title" required maxLength={240} value={newEpisodeTitle} onChange={(event) => setNewEpisodeTitle(event.target.value)} />
                      <TextField id={"episode-duration-" + item.id} label="Duration (minutes)" inputMode="numeric" value={newEpisodeDuration} onChange={(event) => setNewEpisodeDuration(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} />
                      <button className="ui-button ui-button--secondary" type="submit" disabled={createEpisodeMutation.isPending || !newEpisodeTitle.trim() || Number(newEpisodeNumber) < 1 || (newEpisodeDuration !== "" && Number(newEpisodeDuration) < 1)}>Add episode draft</button>
                    </form>
                    {createEpisodeMutation.isError || archiveEpisodeMutation.isError || updateEpisodeMutation.isError ? <p className="admin-error" role="alert">{(createEpisodeMutation.error ?? archiveEpisodeMutation.error ?? updateEpisodeMutation.error)?.message}</p> : null}
                    {adminEpisodesQuery.isLoading ? <div className="catalog-loading">Loading episodes…</div> : null}
                    <ul className="admin-taxonomy-list">{(adminEpisodesQuery.data ?? []).map((episode) => <li key={episode.id}><span>EP {episode.episodeNumber} · {episode.title} · {episode.publicationStatus}</span>{episode.publicationStatus !== "ARCHIVED" ? <div className="admin-episode-actions"><button className="ui-button ui-button--quiet" type="button" onClick={() => updateEpisodeMutation.mutate({ id: episode.id, publicationStatus: episode.publicationStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED" })} disabled={updateEpisodeMutation.isPending}>{episode.publicationStatus === "PUBLISHED" ? "Unpublish" : "Publish"}</button><button className="ui-button ui-button--quiet" type="button" onClick={() => archiveEpisodeMutation.mutate(episode.id)} disabled={archiveEpisodeMutation.isPending}>Archive</button></div> : null}</li>)}</ul>
                  </Surface>
                ) : null}
                {editingId === item.id ? (
                  <Surface className="admin-edit">
                    <form onSubmit={(event) => { event.preventDefault(); editMutation.mutate({ id: item.id, input: { title: editTitle.trim(), slug: editSlug.trim(), synopsis: editSynopsis.trim() || null, releaseYear: editYear ? Number(editYear) : null, genreSlugs: editGenreSlugs, studioSlugs: editStudioSlugs, posterAssetId: editPosterAssetId || null, bannerAssetId: editBannerAssetId || null } }); }}>
                      <TextField id={"edit-title-" + item.id} label="Title" required maxLength={240} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                      <TextField id={"edit-slug-" + item.id} label="Slug" required maxLength={180} value={editSlug} onChange={(event) => setEditSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
                      <TextField id={"edit-year-" + item.id} label="Release year" inputMode="numeric" placeholder="Optional" value={editYear} onChange={(event) => setEditYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} />
                      <label className="ui-field" htmlFor={"edit-synopsis-" + item.id}>Synopsis<textarea id={"edit-synopsis-" + item.id} className="ui-input admin-textarea" maxLength={10000} rows={4} value={editSynopsis} onChange={(event) => setEditSynopsis(event.target.value)} /></label>
                      <label className="ui-field" htmlFor={"edit-genres-" + item.id}>Genres<select multiple className="ui-input admin-multiselect" id={"edit-genres-" + item.id} value={editGenreSlugs} onChange={(event) => setEditGenreSlugs(Array.from(event.target.selectedOptions, (option) => option.value))}>{(adminGenresQuery.data ?? []).map((genre) => <option key={genre.id} value={genre.slug}>{genre.name}</option>)}</select></label>
                      <label className="ui-field" htmlFor={"edit-poster-" + item.id}>Poster asset<select className="ui-input" id={"edit-poster-" + item.id} value={editPosterAssetId} onChange={(event) => setEditPosterAssetId(event.target.value)}><option value="">No poster</option>{(adminAssetsQuery.data ?? []).filter((asset) => asset.mediaKind === "POSTER").map((asset) => <option key={asset.id} value={asset.id}>{asset.originalFilename} · {asset.processingState}</option>)}</select></label>
                      <label className="ui-field" htmlFor={"edit-banner-" + item.id}>Banner asset<select className="ui-input" id={"edit-banner-" + item.id} value={editBannerAssetId} onChange={(event) => setEditBannerAssetId(event.target.value)}><option value="">No banner</option>{(adminAssetsQuery.data ?? []).filter((asset) => asset.mediaKind === "BANNER").map((asset) => <option key={asset.id} value={asset.id}>{asset.originalFilename} · {asset.processingState}</option>)}</select></label>
                      <label className="ui-field" htmlFor={"edit-studios-" + item.id}>Studios<select multiple className="ui-input admin-multiselect" id={"edit-studios-" + item.id} value={editStudioSlugs} onChange={(event) => setEditStudioSlugs(Array.from(event.target.selectedOptions, (option) => option.value))}>{(adminStudiosQuery.data ?? []).map((studio) => <option key={studio.id} value={studio.slug}>{studio.name}</option>)}</select></label>
                      {editMutation.isError ? <p className="admin-error" role="alert">{editMutation.error.message}</p> : null}
                      <div className="admin-record-actions"><button className="ui-button ui-button--primary" type="submit" disabled={editMutation.isPending || !editTitle.trim() || !editSlug.trim() || (editYear !== "" && (Number(editYear) < 1900 || Number(editYear) > 2200))}>{editMutation.isPending ? "Saving…" : "Save changes"}</button><button className="ui-button ui-button--quiet" type="button" onClick={() => setEditingId(null)}>Cancel</button></div>
                    </form>
                  </Surface>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="admin-taxonomy">
        <div className="catalog-section-heading"><div><span className="section-kicker">CATALOGUE STRUCTURE</span><h2>Genres, studios and seasons</h2></div><span>Application-owned metadata</span></div>
        <div className="admin-taxonomy-grid">
          <Surface className="admin-taxonomy-card">
            <h3>Genres</h3>
            <form onSubmit={(event) => { event.preventDefault(); createGenreMutation.mutate(); }}>
              <TextField id="admin-genre-name" label="Genre name" required maxLength={100} value={genreName} onChange={(event) => { setGenreName(event.target.value); setGenreSlug(event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} />
              <TextField id="admin-genre-slug" label="Slug" required maxLength={100} value={genreSlug} onChange={(event) => setGenreSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
              <button className="ui-button ui-button--secondary" type="submit" disabled={createGenreMutation.isPending || !genreName.trim() || !genreSlug.trim()}>Add genre</button>
            </form>
            {createGenreMutation.isError || deleteGenreMutation.isError ? <p className="admin-error" role="alert">{(createGenreMutation.error ?? deleteGenreMutation.error)?.message}</p> : null}
            <ul className="admin-taxonomy-list">{(adminGenresQuery.data ?? []).map((genre) => <li key={genre.id}><span>{genre.name}</span><button type="button" className="ui-button ui-button--quiet" aria-label={"Delete " + genre.name} onClick={() => deleteGenreMutation.mutate(genre.id)} disabled={deleteGenreMutation.isPending}>Delete</button></li>)}</ul>
          </Surface>
          <Surface className="admin-taxonomy-card">
            <h3>Studios</h3>
            <form onSubmit={(event) => { event.preventDefault(); createStudioMutation.mutate(); }}>
              <TextField id="admin-studio-name" label="Studio name" required maxLength={160} value={studioName} onChange={(event) => { setStudioName(event.target.value); setStudioSlug(event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} />
              <TextField id="admin-studio-slug" label="Slug" required maxLength={140} value={studioSlug} onChange={(event) => setStudioSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
              <button className="ui-button ui-button--secondary" type="submit" disabled={createStudioMutation.isPending || !studioName.trim() || !studioSlug.trim()}>Add studio</button>
            </form>
            {createStudioMutation.isError || deleteStudioMutation.isError ? <p className="admin-error" role="alert">{(createStudioMutation.error ?? deleteStudioMutation.error)?.message}</p> : null}
            <ul className="admin-taxonomy-list">{(adminStudiosQuery.data ?? []).map((studio) => <li key={studio.id}><span>{studio.name}</span><button type="button" className="ui-button ui-button--quiet" aria-label={"Delete " + studio.name} onClick={() => deleteStudioMutation.mutate(studio.id)} disabled={deleteStudioMutation.isPending}>Delete</button></li>)}</ul>
          </Surface>
          <Surface className="admin-taxonomy-card">
            <h3>Seasons</h3>
            <form onSubmit={(event) => { event.preventDefault(); createSeasonMutation.mutate(); }}>
              <TextField id="admin-season-year" label="Year" required inputMode="numeric" value={seasonYear} onChange={(event) => setSeasonYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} />
              <label className="ui-field" htmlFor="admin-season-name">Season<select className="ui-input" id="admin-season-name" value={seasonName} onChange={(event) => setSeasonName(event.target.value as typeof seasonName)}><option value="WINTER">Winter</option><option value="SPRING">Spring</option><option value="SUMMER">Summer</option><option value="FALL">Fall</option></select></label>
              <TextField id="admin-season-label" label="Display label (optional)" maxLength={100} value={seasonLabel} onChange={(event) => setSeasonLabel(event.target.value)} />
              <button className="ui-button ui-button--secondary" type="submit" disabled={createSeasonMutation.isPending || seasonYear.length !== 4 || Number(seasonYear) < 1900 || Number(seasonYear) > 2200}>Add season</button>
            </form>
            {createSeasonMutation.isError || deleteSeasonMutation.isError ? <p className="admin-error" role="alert">{(createSeasonMutation.error ?? deleteSeasonMutation.error)?.message}</p> : null}
            <ul className="admin-taxonomy-list">{(adminSeasonsQuery.data ?? []).map((season) => <li key={season.id}><span>{season.label || season.season + " " + season.year}</span><button type="button" className="ui-button ui-button--quiet" aria-label={"Delete " + season.season + " " + season.year} onClick={() => deleteSeasonMutation.mutate(season.id)} disabled={deleteSeasonMutation.isPending}>Delete</button></li>)}</ul>
          </Surface>
        </div>
      </section>
      <section className="admin-taxonomy admin-assets">
        <div className="catalog-section-heading"><div><span className="section-kicker">FIRST-PARTY MEDIA</span><h2>Asset metadata</h2></div><span>Metadata only · no upload or playback</span></div>
        <Surface className="admin-taxonomy-card">
          <p className="admin-asset-note">Register internal storage metadata for a future first-party asset workflow. This does not upload a file, make it available publicly, or accept a remote URL.</p>
          <form onSubmit={(event) => { event.preventDefault(); createAssetMutation.mutate(); }}>
            <TextField id="asset-storage-key" label="Internal storage key" required maxLength={500} placeholder="catalogue/posters/example.webp" value={assetStorageKey} onChange={(event) => setAssetStorageKey(event.target.value)} />
            <TextField id="asset-filename" label="Original filename" required maxLength={255} value={assetFilename} onChange={(event) => setAssetFilename(event.target.value)} />
            <label className="ui-field" htmlFor="asset-kind">Media kind<select className="ui-input" id="asset-kind" value={assetKind} onChange={(event) => { const kind = event.target.value as typeof assetKind; setAssetKind(kind); setAssetMimeType(kind === "POSTER" || kind === "BANNER" ? "image/webp" : kind === "VIDEO" ? "video/mp4" : "text/vtt"); }}><option value="POSTER">Poster</option><option value="BANNER">Banner</option><option value="VIDEO">Video</option><option value="SUBTITLE">Subtitle</option></select></label>
            <TextField id="asset-mime" label="MIME type" required value={assetMimeType} onChange={(event) => setAssetMimeType(event.target.value)} />
            <TextField id="asset-size" label="Size (bytes)" required inputMode="numeric" value={assetSizeBytes} onChange={(event) => setAssetSizeBytes(event.target.value.replace(/[^0-9]/g, ""))} />
            <button className="ui-button ui-button--secondary" type="submit" disabled={createAssetMutation.isPending || !assetStorageKey.trim() || !assetFilename.trim() || !assetMimeType.trim() || Number(assetSizeBytes) <= 0}>Register metadata</button>
          </form>
          {createAssetMutation.isError || deleteAssetMutation.isError ? <p className="admin-error" role="alert">{(createAssetMutation.error ?? deleteAssetMutation.error)?.message}</p> : null}
          <ul className="admin-taxonomy-list">{(adminAssetsQuery.data ?? []).map((asset) => <li key={asset.id}><span>{asset.mediaKind} · {asset.originalFilename} · {asset.sizeBytes} bytes · {asset.processingState}</span><button type="button" className="ui-button ui-button--quiet" onClick={() => deleteAssetMutation.mutate(asset.id)} disabled={deleteAssetMutation.isPending}>Delete</button></li>)}</ul>
        </Surface>
      </section>
    </main>
  );
}

export default function App() {
  const healthQuery = useQuery({
    queryKey: ["system", "health"],
    queryFn: () => apiClient.health(),
    retry: false,
    refetchInterval: 60_000,
  });
  const apiStatus = healthQuery.isSuccess
    ? { label: "API CONNECTED", tone: "positive" as const, accessible: "API status: connected" }
    : healthQuery.isError
      ? { label: "API UNAVAILABLE", tone: "warning" as const, accessible: "API status: unavailable" }
      : { label: "API CHECKING", tone: "neutral" as const, accessible: "API status: checking" };

  return (
    <div className="app-frame">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Samren home"><span className="brand-mark">S</span><span>SAMREN</span></Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link to="/"><Sparkles size={15} /> Home</Link>
          <Link to="/browse"><Compass size={15} /> Discover</Link>
          <Link to="/search"><Search size={15} /> Search</Link>
          <Link to="/library"><Library size={15} /> My Library</Link>
          <Link to="/admin">Admin</Link>
        </nav>
        <StatusBadge tone={apiStatus.tone} label={apiStatus.accessible}>{apiStatus.label}</StatusBadge>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/search" element={<BrowsePage />} />
        <Route path="/anime/:slug" element={<AnimeDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<main className="page-shell"><section className="simple-page"><span className="section-kicker">COMING INTO FOCUS</span><h1>That page is not ready yet.</h1><Link className="text-link" to="/">Return home</Link></section></main>} />
      </Routes>
      <footer className="site-footer"><span>© {new Date().getFullYear()} SAMREN</span><span>BUILT AROUND YOUR COLLECTION</span></footer>
    </div>
  );
}
