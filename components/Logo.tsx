/**
 * BangBuck mark: a coin with a lightning bolt struck out of it — the "bang"
 * cut from the "buck". Negative space rather than an overlaid glyph, so it stays
 * legible down to favicon size.
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bb-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5ba0f0" />
          <stop offset="100%" stopColor="#1c5cab" />
        </linearGradient>
        <mask id="bb-bolt">
          <rect width="32" height="32" fill="white" />
          <path d="M18.6 4.5 L9.6 17.8 h4.8 L13.4 27.5 L22.4 14.2 h-4.8 z" fill="black" />
        </mask>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#bb-coin)" mask="url(#bb-bolt)" />
    </svg>
  );
}

/** Mark + wordmark, for the page header. */
export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={30} />
      <span
        className="text-[21px] font-semibold tracking-[-0.02em]"
        style={{ color: "var(--text-primary)" }}
      >
        Bang<span style={{ color: "var(--accent)" }}>Buck</span>
      </span>
    </div>
  );
}
