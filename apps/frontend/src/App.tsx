import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Compass, Library, Search, Sparkles, SlidersHorizontal } from "lucide-react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import type { CatalogAnimeCard, CatalogAnimeDetail, CatalogListParams } from "@samren/types";
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
        </nav>
        <StatusBadge tone={apiStatus.tone} label={apiStatus.accessible}>{apiStatus.label}</StatusBadge>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/search" element={<BrowsePage />} />
        <Route path="/anime/:slug" element={<AnimeDetailPage />} />
        <Route path="*" element={<main className="page-shell"><section className="simple-page"><span className="section-kicker">COMING INTO FOCUS</span><h1>That page is not ready yet.</h1><Link className="text-link" to="/">Return home</Link></section></main>} />
      </Routes>
      <footer className="site-footer"><span>© {new Date().getFullYear()} SAMREN</span><span>BUILT AROUND YOUR COLLECTION</span></footer>
    </div>
  );
}
