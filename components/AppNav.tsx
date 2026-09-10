import { Logo } from "./Logo";

export function AppNav() {
  return (
    <nav className="app-nav" aria-label="Main navigation">
      <div className="app-nav-inner">
        <a href="#top" className="nav-brand" aria-label="BangBuck, back to top">
          <Logo size={24} /> BangBuck
        </a>
        <div className="nav-links">
          <a href="#answer">Overview</a>
          <a href="#compare">Compare</a>
          <a href="#rankings">Rankings</a>
          <a href="#sources" className="nav-secondary">Sources</a>
        </div>
      </div>
    </nav>
  );
}
