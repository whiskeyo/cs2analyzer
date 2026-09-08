export function PlaybookEmpty() {
  return (
    <div className="playbook-empty muted">
      <svg
        className="playbook-empty-art"
        viewBox="0 0 160 120"
        width="160"
        height="120"
        aria-hidden="true"
      >
        <rect x="8" y="10" width="144" height="100" rx="8" fill="#0b0e12" stroke="#2a3848" />
        <rect x="20" y="22" width="88" height="76" rx="4" fill="#17202a" stroke="#243040" />
        <circle cx="64" cy="60" r="18" fill="none" stroke="#3d5166" strokeWidth="1.4" />
        <path d="M64 42v36M46 60h36" stroke="#3d5166" strokeWidth="1.2" />
        <circle cx="78" cy="48" r="4" fill="#5b9fd6" />
        <circle cx="52" cy="70" r="4" fill="#c9a227" />
        <rect x="116" y="24" width="24" height="6" rx="2" fill="#2a3848" />
        <rect x="116" y="36" width="20" height="5" rx="2" fill="#243040" />
        <rect x="116" y="46" width="22" height="5" rx="2" fill="#243040" />
        <rect x="116" y="62" width="24" height="6" rx="2" fill="#2a3848" />
        <rect x="120" y="74" width="16" height="4" rx="2" fill="#243040" />
        <rect x="120" y="82" width="14" height="4" rx="2" fill="#243040" />
      </svg>
      <p>Open a playbook to draw on the radar.</p>
    </div>
  );
}
