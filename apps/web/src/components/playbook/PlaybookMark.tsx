/** Tactics-board mark — same visual weight as the Home drop favicon. */
export function PlaybookMark() {
  return (
    <svg
      className="brand-mark home-playbook-mark"
      viewBox="0 0 56 56"
      width={56}
      height={56}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="54" height="54" rx="12" fill="#0b0e12" stroke="#2a3848" />
      <rect x="8" y="8" width="40" height="40" rx="6" fill="#17202a" stroke="#243040" />
      <circle cx="28" cy="28" r="11" fill="none" stroke="#3d5166" strokeWidth="1.4" />
      <path d="M28 17v22M17 28h22" stroke="#3d5166" strokeWidth="1.2" />
      <circle cx="36" cy="20" r="3.2" fill="#5b9fd6" />
      <circle cx="21" cy="35" r="3.2" fill="#c9a227" />
    </svg>
  );
}
