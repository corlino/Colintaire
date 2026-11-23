import type { Suit } from '../engine/types';

/** Inline suit symbols so they render identically on every device (TAD §12.3). */
export function SuitIcon({ suit, size, className }: { suit: Suit; size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      {suit === 'H' && (
        <path d="M12 21.2s-8.7-6.1-8.7-12.1C3.3 6.1 5.5 4 8.1 4c1.7 0 3.1.9 3.9 2.3C12.8 4.9 14.2 4 15.9 4c2.6 0 4.8 2.1 4.8 5.1 0 6-8.7 12.1-8.7 12.1z" />
      )}
      {suit === 'D' && <path d="M12 2.2 19.6 12 12 21.8 4.4 12z" />}
      {suit === 'S' && (
        <path d="M12 2.4s-8.6 6.4-8.6 11.6c0 2.7 2.1 4.5 4.4 4.5 1.4 0 2.6-.6 3.4-1.6-.2 1.9-.9 3.5-2.4 4.9h6.4c-1.5-1.4-2.2-3-2.4-4.9.8 1 2 1.6 3.4 1.6 2.3 0 4.4-1.8 4.4-4.5 0-5.2-8.6-11.6-8.6-11.6z" />
      )}
      {suit === 'C' && (
        <>
          <circle cx="12" cy="7.2" r="4.3" />
          <circle cx="6.8" cy="13.6" r="4.3" />
          <circle cx="17.2" cy="13.6" r="4.3" />
          <circle cx="12" cy="12.4" r="2.6" />
          <path d="M11 13.5c0 3.6-.9 5.9-2.6 8.3h7.2c-1.7-2.4-2.6-4.7-2.6-8.3z" />
        </>
      )}
    </svg>
  );
}
