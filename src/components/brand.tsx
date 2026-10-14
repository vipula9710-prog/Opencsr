/** OpenCSR application mark (original artwork, Apache-2.0 with the project). */
export function OpenCsrMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="#176B45" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#F4F8F5" strokeWidth="2.5" />
      <path d="M16 9c3.5 2.5 3.5 11.5 0 14-3.5-2.5-3.5-11.5 0-14z" fill="#C6A15B" />
    </svg>
  );
}
