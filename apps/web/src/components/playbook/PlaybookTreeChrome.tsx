export function TreeIcon({ kind }: { kind: "map" | "book" | "strat" }) {
  if (kind === "map") {
    return (
      <svg className="playbook-tree-icon" viewBox="0 0 16 16" aria-hidden>
        <path
          fill="currentColor"
          d="M2 3.2 6 2l4 1.4L14 2v10.8L10 14l-4-1.4L2 14zM6 3.4v8.4m4-7.6v8.4"
          fillOpacity="0"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "book") {
    return (
      <svg className="playbook-tree-icon" viewBox="0 0 16 16" aria-hidden>
        <path
          fill="currentColor"
          d="M3 2.5h7.2A2.3 2.3 0 0 1 12.5 4.8V13H4.2A1.2 1.2 0 0 1 3 11.8z"
          opacity="0.85"
        />
        <path fill="#0b0e12" d="M4.4 4.2h6.2v1.1H4.4zm0 2.2h5.2v1H4.4z" />
      </svg>
    );
  }
  return (
    <svg className="playbook-tree-icon" viewBox="0 0 16 16" aria-hidden>
      <path fill="currentColor" d="M4 2h6.2L13 5v9H4z" opacity="0.9" />
      <path fill="#0b0e12" d="M5.2 7h5.6v1H5.2zm0 2.2h4.2v1H5.2z" />
    </svg>
  );
}
