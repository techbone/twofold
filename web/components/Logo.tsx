export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="7" y="7" width="10" height="10" rx="2" fill="var(--accent)" />
      </svg>
      <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">Twofold</span>
    </span>
  );
}
