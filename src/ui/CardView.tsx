import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { CardFaceSet } from '../assets/registry';
import { colorOf } from '../engine/cards';
import type { Card } from '../engine/types';
import { rankLabel, SUIT_NAME } from './format';
import { SuitIcon } from './SuitIcon';

export interface CardSize {
  readonly w: number;
  readonly h: number;
  readonly radius: number;
  readonly rankFont: number;
}

/** A one-off instruction to start the next move from somewhere else (drop point, stock on deal). */
export interface Jump {
  readonly x: number;
  readonly y: number;
  readonly nonce: number;
  readonly delay?: number;
}

/** Motion timings (Style Guide §9, TAD §10.4), in seconds. */
export const MOTION = {
  move: 0.18,
  deal: 0.22,
  flip: 0.2,
  lift: 0.12,
  shake: 0.2,
} as const;

const LIFT = 6;

/** Placeholder "Classic" face (TAD §12.3): white, rank+suit in both corner rows, both upright (U20). */
function ClassicFace({ card, size }: { card: Card; size: CardSize }) {
  const color = colorOf(card.suit) === 'red' ? 'text-card-red' : 'text-card-black';
  const label = rankLabel(card.rank);
  const pad = Math.max(3, Math.round(size.w * 0.07));
  const suitSize = Math.round(size.rankFont * 0.8);
  const row = 'absolute inset-x-0 flex items-center justify-between font-bold leading-none';
  return (
    <div className={`absolute inset-0 bg-card-face ${color}`} style={{ borderRadius: size.radius }}>
      <div className={row} style={{ top: 2, paddingInline: pad, fontSize: size.rankFont, height: size.rankFont }}>
        <span>{label}</span>
        <SuitIcon suit={card.suit} size={suitSize} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <SuitIcon suit={card.suit} size={Math.round(size.w * 0.42)} />
      </div>
      <div className={row} style={{ bottom: 2, paddingInline: pad, fontSize: size.rankFont, height: size.rankFont }}>
        <SuitIcon suit={card.suit} size={suitSize} />
        <span>{label}</span>
      </div>
    </div>
  );
}

/** Face or back only — no positioning. Shared by the board, drag layer and peek panel. */
export function CardFace({ card, size, backSrc, faces }: { card: Card; size: CardSize; backSrc: string; faces: CardFaceSet }) {
  const image = faces.kind === 'images' ? faces.images?.[card.id] : undefined;
  return (
    <>
      {card.faceUp ? (
        image ? (
          <img src={image} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        ) : (
          <ClassicFace card={card} size={size} />
        )
      ) : (
        <img src={backSrc} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
      )}
      <div className="pointer-events-none absolute inset-0 border border-card-border" style={{ borderRadius: size.radius }} />
    </>
  );
}

export const cardLabel = (card: Card) => (card.faceUp ? `${rankLabel(card.rank)} of ${SUIT_NAME[card.suit]}` : 'Face-down card');

export interface CardViewProps {
  readonly card: Card;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: CardSize;
  readonly backSrc: string;
  readonly faces: CardFaceSet;
  readonly selected?: boolean;
  /** The card the player picked; only it gets the outline, the rest of the run just lifts. */
  readonly outlined?: boolean;
  readonly hidden?: boolean;
  readonly jump?: Jump;
  /** Changing this number plays the invalid-move shake. */
  readonly shake?: number;
}

/** A card on the board. Animates to (x, y) whenever its layout position changes. */
export const CardView = memo(function CardView({ card, x, y, z, size, backSrc, faces, selected, outlined, hidden, jump, shake }: CardViewProps) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(jump ? jump.x : x);
  const my = useMotionValue(jump ? jump.y : y);
  const shakeX = useMotionValue(0);
  const warn = useMotionValue(0);
  const appliedJump = useRef(0);
  const appliedShake = useRef(shake ?? 0);

  // Flip: replay a short rotateY whenever the face changes after mount.
  const [shownFace, setShownFace] = useState(card.faceUp);
  const [flips, setFlips] = useState(0);
  if (shownFace !== card.faceUp) {
    setShownFace(card.faceUp);
    setFlips((n) => n + 1);
  }

  useLayoutEffect(() => {
    let delay = 0;
    let duration: number = MOTION.move;
    if (jump && jump.nonce !== appliedJump.current) {
      appliedJump.current = jump.nonce;
      mx.jump(jump.x);
      my.jump(jump.y);
      delay = jump.delay ?? 0;
      if (jump.delay !== undefined) duration = MOTION.deal;
    }
    const targetY = y - (selected ? LIFT : 0);
    const opts = reduce ? { duration: 0 } : { duration: selected ? MOTION.lift : duration, ease: 'easeOut' as const, delay };
    const ax = animate(mx, x, opts);
    const ay = animate(my, targetY, opts);
    return () => {
      ax.stop();
      ay.stop();
    };
  }, [x, y, selected, jump, reduce, mx, my]);

  useLayoutEffect(() => {
    if (!shake || shake === appliedShake.current) return;
    appliedShake.current = shake;
    if (reduce) return;
    const a = animate(shakeX, [0, -6, 6, -4, 4, 0], { duration: MOTION.shake });
    const b = animate(warn, [0, 1, 1, 0], { duration: 0.25 });
    return () => {
      a.stop();
      b.stop();
    };
  }, [shake, reduce, shakeX, warn]);

  return (
    <motion.div
      className="card absolute top-0 left-0"
      style={{ x: mx, y: my, width: size.w, height: size.h, zIndex: z, opacity: hidden ? 0 : 1, perspective: 600 }}
      data-card={card.id}
      aria-label={cardLabel(card)}
    >
      <motion.div className="absolute inset-0" style={{ x: shakeX }}>
        <motion.div
          key={String(card.faceUp)}
          className="absolute inset-0 overflow-hidden"
          style={{
            borderRadius: size.radius,
            backfaceVisibility: 'hidden',
            boxShadow: selected ? '0 6px 14px rgba(0,0,0,0.45)' : undefined,
          }}
          initial={flips > 0 && !reduce ? { rotateY: 90 } : false}
          animate={{ rotateY: 0 }}
          transition={{ duration: MOTION.flip, ease: 'easeOut' }}
        >
          <CardFace card={card} size={size} backSrc={backSrc} faces={faces} />
        </motion.div>
        {outlined && (
          <div className="pointer-events-none absolute -inset-[2px] border-2 border-accent" style={{ borderRadius: size.radius + 2 }} />
        )}
        <motion.div
          className="pointer-events-none absolute -inset-[2px] border-2 border-card-red/70"
          style={{ borderRadius: size.radius + 2, opacity: warn }}
        />
      </motion.div>
    </motion.div>
  );
});
