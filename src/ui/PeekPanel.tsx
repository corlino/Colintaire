import type { CardFaceSet } from '../assets/registry';
import type { Pile } from '../engine/types';
import type { Metrics } from '../layout';
import { CardFace, cardLabel, type CardSize } from './CardView';

/**
 * Peek (TAD §9.4): the whole column fully fanned over a dimmed board. Tapping a
 * face-up card picks it (and the cards above it) up as the selection, which is
 * how a player moves from the middle of a folded run. Tapping outside closes.
 * Does not pause the timer or change the game.
 */
export function PeekPanel({
  cards,
  metrics,
  size,
  backSrc,
  faces,
  onPick,
  onClose,
}: {
  cards: Pile;
  metrics: Metrics;
  size: CardSize;
  backSrc: string;
  faces: CardFaceSet;
  onPick: (cardIndex: number) => void;
  onClose: () => void;
}) {
  const pad = 16;
  const n = cards.length;
  const room = metrics.boardH - 2 * pad - metrics.cardH;
  const step = n > 1 ? Math.min(metrics.offsets.up * 1.25, room / (n - 1)) : 0;
  const height = metrics.cardH + step * Math.max(0, n - 1);

  return (
    <div
      className="absolute inset-0 z-[2000] flex items-center justify-center rounded-lg bg-black/55"
      onPointerUp={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Column"
      data-testid="peek"
    >
      <div className="relative rounded-lg bg-modal p-lg shadow-2xl" style={{ width: metrics.cardW + 2 * pad, height: height + 2 * pad }}>
        {cards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            aria-label={cardLabel(card)}
            disabled={!card.faceUp}
            onPointerUp={(e) => {
              e.stopPropagation();
              onPick(i);
            }}
            className="absolute overflow-hidden"
            style={{ left: pad, top: pad + i * step, width: size.w, height: size.h, borderRadius: size.radius, zIndex: i }}
          >
            <CardFace card={card} size={size} backSrc={backSrc} faces={faces} />
          </button>
        ))}
      </div>
    </div>
  );
}
