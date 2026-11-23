/** Shapes of the art shown in preview circles. */
export const PREVIEW_ASPECT = {
  /** Portrait phone background (1290 × 2796, TAD §12.5). */
  theme: 1290 / 2796,
  /** Poker card, 5:7. */
  card: 5 / 7,
} as const;

/**
 * A round preview that keeps the art's own proportions and crops it to the
 * circle (centre crop), rather than squeezing it into a square.
 * Pass `src` for an image, or `background` for a CSS background.
 */
export function CroppedPreview({ aspect, src, background, className = '' }: { aspect: number; src?: string; background?: string; className?: string }) {
  const portrait = aspect <= 1;
  const inner: React.CSSProperties = {
    position: 'absolute',
    aspectRatio: String(aspect),
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    ...(portrait ? { width: '100%' } : { height: '100%' }),
  };
  return (
    <span className={`relative block overflow-hidden rounded-full ${className}`} aria-hidden="true">
      {src ? (
        <img src={src} alt="" draggable={false} style={{ ...inner, objectFit: 'fill' }} />
      ) : (
        <span style={{ ...inner, background }} />
      )}
    </span>
  );
}
