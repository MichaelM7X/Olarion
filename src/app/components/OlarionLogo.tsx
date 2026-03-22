interface OlarionLogoProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

// ─── Geometry ────────────────────────────────────────────────────────────────
// ViewBox 200×200, centre (100,100).
// Gap: 300° → 323°  (≈23°, rotated +15° CW from previous → ~1–2 o'clock)
//   cos300=0.5000  sin300=-0.8660
//   cos323≈0.7986  sin323≈-0.6018
//
// Three equal-width (10 unit) concentric annular bands:
//   Outer  r82→r72   deepest blue
//   Middle r72→r62   medium blue
//   Inner  r62→r52   lightest blue
//
// Key arc points (precomputed):
//   r82 @300° → (141.00, 28.99)   r82 @323° → (165.49, 50.65)
//   r72 @300° → (136.00, 37.65)   r72 @323° → (157.50, 56.67)
//   r62 @300° → (131.00, 46.31)   r62 @323° → (149.52, 62.69)
//   r52 @300° → (126.00, 54.97)   r52 @323° → (141.53, 68.71)
//
// Each band path:
//   M outer@323°  →  CW large arc(337°) to outer@300°
//   L inner@300°  →  CCW large arc(337°) to inner@323°
//   Z             (line = radial gap edge, collinear with centre → clean cut)
// ─────────────────────────────────────────────────────────────────────────────

export function OlarionLogo({ className = '', size = 36, animate = true }: OlarionLogoProps) {
  const id = `olarion-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Outer band — deepest blue */}
        <linearGradient id={`${id}-c`} x1="100" y1="13" x2="100" y2="187" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7EB4FB">
            {animate && (
              <animate attributeName="stop-color" values="#7EB4FB;#93C5FD;#6DA8F8;#7EB4FB" dur="6s" repeatCount="indefinite" />
            )}
          </stop>
          <stop offset="1" stopColor="#1743C4">
            {animate && (
              <animate attributeName="stop-color" values="#1743C4;#2563EB;#1338A8;#1743C4" dur="6s" repeatCount="indefinite" />
            )}
          </stop>
        </linearGradient>

        {/* Middle band */}
        <linearGradient id={`${id}-b`} x1="100" y1="13" x2="100" y2="187" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A8CBFD">
            {animate && (
              <animate attributeName="stop-color" values="#A8CBFD;#BFDBFE;#93C5FD;#A8CBFD" dur="6s" repeatCount="indefinite" />
            )}
          </stop>
          <stop offset="1" stopColor="#2D6EE8">
            {animate && (
              <animate attributeName="stop-color" values="#2D6EE8;#3B82F6;#2060D4;#2D6EE8" dur="6s" repeatCount="indefinite" />
            )}
          </stop>
        </linearGradient>

        {/* Inner band — lightest */}
        <linearGradient id={`${id}-a`} x1="100" y1="13" x2="100" y2="187" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C8E2FF">
            {animate && (
              <animate attributeName="stop-color" values="#C8E2FF;#D1E9FF;#BAD9FE;#C8E2FF" dur="6s" repeatCount="indefinite" />
            )}
          </stop>
          <stop offset="1" stopColor="#4D8FF5">
            {animate && (
              <animate attributeName="stop-color" values="#4D8FF5;#60A5FA;#3B82F6;#4D8FF5" dur="6s" repeatCount="indefinite" />
            )}
          </stop>
        </linearGradient>
      </defs>

      {/* Whole ring group — subtle breathing rotation */}
      <g>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 100 100;1.5 100 100;0 100 100;-1.5 100 100;0 100 100"
            dur="10s"
            repeatCount="indefinite"
          />
        )}

        {/* ── Outer band r82→r72 ── */}
        <path
          d="M 165.49 50.65 A 82 82 0 1 1 141.00 28.99 L 136.00 37.65 A 72 72 0 1 0 157.50 56.67 Z"
          fill={`url(#${id}-c)`}
        />

        {/* ── Middle band r72→r62 ── */}
        <path
          d="M 157.50 56.67 A 72 72 0 1 1 136.00 37.65 L 131.00 46.31 A 62 62 0 1 0 149.52 62.69 Z"
          fill={`url(#${id}-b)`}
        />

        {/* ── Inner band r62→r52 ── */}
        <path
          d="M 149.52 62.69 A 62 62 0 1 1 131.00 46.31 L 126.00 54.97 A 52 52 0 1 0 141.53 68.71 Z"
          fill={`url(#${id}-a)`}
        />

        {/* ── Band crease dividers (drawn on top of fills) ── */}
        <path
          d="M 157.50 56.67 A 72 72 0 1 1 136.00 37.65"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="0.9"
        />
        <path
          d="M 149.52 62.69 A 62 62 0 1 1 131.00 46.31"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="0.9"
        />

        {/* ── Outer edge highlight ── */}
        <path
          d="M 165.49 50.65 A 82 82 0 1 1 141.00 28.99"
          stroke="rgba(200,228,255,0.35)"
          strokeWidth="0.7"
        />
      </g>
    </svg>
  );
}
