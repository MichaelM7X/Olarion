import { Link, useLocation } from 'react-router';
import { ClarionLogo } from './ClarionLogo';

export function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <ClarionLogo size={48} />
            <span className="font-serif text-xl text-[var(--foreground)]">Clarion</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm transition-colors ${
                isActive('/')
                  ? 'text-[var(--accent-primary)] font-medium'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              Home
            </Link>
            <Link
              to="/past-audits"
              className={`text-sm transition-colors ${
                isActive('/past-audits')
                  ? 'text-[var(--accent-primary)] font-medium'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              Past Audits
            </Link>
            <Link
              to="/setup"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:bg-[var(--accent-primary)] transition-colors"
            >
              New Audit
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
