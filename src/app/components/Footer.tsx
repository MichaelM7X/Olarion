import { ClarionLogo } from './ClarionLogo';

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-[var(--border)] bg-white/60 backdrop-blur-sm mt-24">
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between">
          {/* Logo and Copyright */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <ClarionLogo size={40} />
              <span className="font-serif text-lg text-[var(--foreground)]">Clarion</span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              © 2026 Clarion. All rights reserved.
            </p>
          </div>

          {/* Additional Links */}
          <div className="flex items-center gap-6">
            <span className="text-sm text-[var(--muted-foreground)]">
              Enterprise Model Audit Tool
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
