import { Link, Route, Routes } from "react-router-dom";
import { Clapperboard, Compass, Library, Search, Sparkles } from "lucide-react";

function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-panel" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={14} /> YOUR ANIME SPACE</span>
          <h1 id="hero-title">A quieter way<br />to <span>find your next</span><br />favorite story.</h1>
          <p>Build your own collection, keep track of every episode, and make your watchlist feel like home.</p>
          <Link className="primary-action" to="/browse">Explore your library <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring-one" />
          <div className="orbit-ring orbit-ring-two" />
          <div className="orbit-core"><Clapperboard size={42} strokeWidth={1.2} /></div>
          <span className="orbit-star star-one">✦</span>
          <span className="orbit-star star-two">✧</span>
        </div>
        <div className="hero-index"><span>01</span><span className="index-line" /><span>CURATED FOR YOU</span></div>
      </section>
      <section className="welcome-row">
        <div><span className="section-kicker">THE COLLECTION STARTS HERE</span><h2>Your next chapter awaits.</h2></div>
        <p>Samren is being rebuilt around a catalogue you own and control. No third-party anime feeds or stream providers.</p>
      </section>
      <section className="empty-library" aria-label="Library status">
        <div className="empty-icon"><Library size={22} /></div>
        <div><h3>Your library is taking shape</h3><p>Catalogue collections will appear here once they are added by an administrator.</p></div>
        <span className="status-pill">FOUNDATION</span>
      </section>
    </main>
  );
}

function BrowsePage() {
  return <main className="page-shell"><section className="simple-page"><span className="section-kicker">DISCOVER</span><h1>Browse</h1><p>The application-owned catalogue arrives in Phase 2.</p></section></main>;
}

export default function App() {
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
        <span className="topbar-note">YOUR PERSONAL ANIME SPACE</span>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="*" element={<main className="page-shell"><section className="simple-page"><span className="section-kicker">COMING INTO FOCUS</span><h1>That page is not ready yet.</h1><Link className="text-link" to="/">Return home</Link></section></main>} />
      </Routes>
      <footer className="site-footer"><span>© {new Date().getFullYear()} SAMREN</span><span>BUILT AROUND YOUR COLLECTION</span></footer>
    </div>
  );
}