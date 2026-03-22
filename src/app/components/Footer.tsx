import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-[var(--border)] bg-white/60 backdrop-blur-sm mt-24">
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between">
          {/* Logo and Copyright */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-serif text-lg text-[var(--foreground)]">LeakGuard</span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              © 2026 LeakGuard. All rights reserved.
            </p>
          </div>

          {/* Additional Links */}
          <div className="flex items-center gap-6">
            <span className="text-sm text-[var(--muted-foreground)]">
              Enterprise Audit Tool
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
