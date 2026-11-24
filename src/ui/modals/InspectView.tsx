import { XMarkIcon } from '@heroicons/react/24/outline';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CARD_BACKS, CARD_FACES, DEFAULTS, pick } from '../../assets/registry';
import type { Card } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { CardFace, cardLabel, type CardSize } from '../CardView';

/** Largest card that fits: 85% of the width, 78% of the height, never wider than 420 px. */
function largeSize(): CardSize {
  const vw = typeof window === 'undefined' ? 375 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 812 : window.innerHeight;
  const w = Math.round(Math.min(vw * 0.85, ((vh * 0.78) * 5) / 7, 420));
  return { w, h: Math.round((w * 7) / 5), radius: Math.round(w * 0.06), rankFont: Math.round(w * 0.2) };
}

function useLargeSize() {
  const [size, setSize] = useState(largeSize);
  useEffect(() => {
    const onResize = () => setSize(largeSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/**
 * Inspect view: the selected card shown large over a dimmed game. Tap the card
 * to turn it over and see the back; X, Escape or a tap outside closes it.
 * Uses the full-size art when the asset pipeline made one.
 */
export function InspectView() {
  const reduce = useReducedMotion();
  const cardId = useGameStore((s) => s.inspectCardId);
  const board = useGameStore((s) => s.session.game.board);
  const settings = useGameStore((s) => s.settings);
  const closeModal = useGameStore((s) => s.closeModal);
  const size = useLargeSize();
  const [side, setSide] = useState<'front' | 'back'>('front');
  const flipRef = useRef<HTMLButtonElement>(null);

  const { stock, waste, foundations, tableau } = board;
  const found = [...stock, ...waste, ...foundations.flat(), ...tableau.flat()].find((c) => c.id === cardId);
  const card: Card | undefined = found && { ...found, faceUp: true };

  const back = pick(CARD_BACKS, settings.cardBackId, DEFAULTS.back);
  const faceSet = pick(CARD_FACES, settings.cardFaceId, DEFAULTS.face);
  const faces = faceSet.imagesLarge ? { ...faceSet, images: faceSet.imagesLarge } : faceSet;
  const backSrc = back.srcLarge ?? back.src;

  const closeRef = useRef(closeModal);
  useEffect(() => {
    closeRef.current = closeModal;
  });
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    flipRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  if (!card) return null;
  const fade = { duration: reduce ? 0.12 : 0.2 };
  const name = cardLabel(card);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={name}>
      <motion.div
        className="absolute inset-0 bg-black/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: fade }}
        transition={fade}
        onClick={closeModal}
        data-testid="inspect-backdrop"
      />
      <button
        type="button"
        aria-label="Close"
        onClick={closeModal}
        className="absolute flex size-11 items-center justify-center rounded-md text-text-primary active:scale-96 focus-visible:outline-2 focus-visible:outline-white"
        style={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: 12 }}
      >
        <XMarkIcon className="size-8" strokeWidth={1.5} aria-hidden="true" />
      </button>
      <motion.div
        className="relative"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduce ? { opacity: 0, transition: fade } : { opacity: 0, scale: 0.85, transition: fade }}
        transition={fade}
        style={{ width: size.w, height: size.h, perspective: size.w * 4 }}
      >
        <button
          ref={flipRef}
          type="button"
          aria-label="Flip card"
          data-side={side}
          onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
          className={`inspect-card relative block size-full cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
            side === 'back' ? 'is-back' : ''
          } ${reduce ? 'reduce' : ''}`}
          style={{ borderRadius: size.radius }}
        >
          <span className="inspect-side absolute inset-0 overflow-hidden shadow-2xl" style={{ borderRadius: size.radius }}>
            <CardFace card={card} size={size} backSrc={backSrc} faces={faces} />
          </span>
          <span className="inspect-side inspect-back absolute inset-0 overflow-hidden shadow-2xl" style={{ borderRadius: size.radius }}>
            <CardFace card={{ ...card, faceUp: false }} size={size} backSrc={backSrc} faces={faces} />
          </span>
        </button>
        <p className="pointer-events-none absolute inset-x-0 top-full pt-lg text-center text-xs text-text-muted">Tap the card to turn it over</p>
      </motion.div>
    </div>,
    document.getElementById('modal-root') ?? document.body,
  );
}
