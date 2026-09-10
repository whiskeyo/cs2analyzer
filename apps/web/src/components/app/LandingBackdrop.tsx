/** Home-only decorative layer. Pointer-events none; does not change page structure. */
export function LandingBackdrop() {
  return (
    <div className="landing-backdrop" aria-hidden="true">
      <div className="landing-backdrop-wash" />
      <div className="landing-backdrop-grid" />
      <svg
        className="landing-backdrop-radar"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <radialGradient id="landing-radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6aa4d8" stopOpacity="0.14" />
            <stop offset="70%" stopColor="#6aa4d8" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#6aa4d8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="landing-sweep-fill" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#6aa4d8" stopOpacity="0" />
            <stop offset="100%" stopColor="#6aa4d8" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <g transform="translate(780 390)">
          <circle r="280" fill="url(#landing-radar-glow)" />
          <circle className="landing-radar-ring" r="88" />
          <circle className="landing-radar-ring" r="168" />
          <circle className="landing-radar-ring" r="248" />
          <path className="landing-radar-ring" d="M0 -270 v540 M-270 0 h540" />
        </g>
        <path className="landing-radar-sweep" d="M780 390 L780 142 A248 248 0 0 1 898 172 Z" />
        <path className="landing-radar-path" d="M210 560 C 340 500, 470 430, 640 390" />
        <circle className="landing-radar-smoke" cx="640" cy="390" r="36" />
        <circle className="landing-radar-t" cx="248" cy="538" r="5" />
        <circle className="landing-radar-t" cx="318" cy="498" r="4.5" />
        <circle className="landing-radar-t" cx="402" cy="452" r="4.5" />
        <circle className="landing-radar-ct" cx="742" cy="348" r="5" />
        <circle className="landing-radar-ct" cx="812" cy="412" r="4.5" />
      </svg>
      <div className="landing-backdrop-grain" />
      <div className="landing-backdrop-vignette" />
    </div>
  );
}
