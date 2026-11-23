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
  const el = useRef<HTMLDivElement>(null);
  /** The running deal flight (a Web Animation on the compositor) and where it lands. */
  const dealFlight = useRef<{ anim: Animation; x: number; y: number } | null>(null);

  // Flip: replay a short flip whenever the face changes after mount. A new deal is different:
  // every card flies out face-down and a face-up card turns over as it lands (`dealReveal`,
  // seconds from now), instead of dozens of cards flipping at once under the stock.
  const dealNonce = jump?.delay !== undefined ? jump.nonce : null;
  const [seenDeal, setSeenDeal] = useState<number | null>(null);
  const newDeal = dealNonce !== null && dealNonce !== seenDeal;
  const [dealReveal, setDealReveal] = useState<number | null>(null);
  if (newDeal) {
    setSeenDeal(dealNonce);
    setDealReveal(card.faceUp && jump?.delay ? jump.delay + MOTION.deal : card.faceUp && jump ? MOTION.deal : null);
  }
  const [shownFace, setShownFace] = useState(card.faceUp);
  const [animateFlip, setAnimateFlip] = useState(false);
  if (shownFace !== card.faceUp) {
    setShownFace(card.faceUp);
    setAnimateFlip(!newDeal);
    if (!newDeal) setDealReveal(null);
  }
  const revealing = dealReveal !== null && !reduce;

  useLayoutEffect(() => {
    const targetY = y - (selected ? LIFT : 0);
    if (jump && jump.nonce !== appliedJump.current) {
      appliedJump.current = jump.nonce;
      if (jump.delay !== undefined) {
        // Deal: the card's real position is set at once, and the flight from the stock runs as a
        // Web Animation on the compositor, so startup work or React rendering can't stall it.
        mx.jump(x);
        my.jump(targetY);
        dealFlight.current?.anim.cancel();
        dealFlight.current = null;
        const node = el.current;
        if (!reduce && node && typeof node.animate === 'function' && (jump.x !== x || jump.y !== targetY)) {
          const anim = node.animate(
            [{ transform: `translateX(${jump.x}px) translateY(${jump.y}px)` }, { transform: `translateX(${x}px) translateY(${targetY}px)` }],
            { duration: MOTION.deal * 1000, delay: jump.delay * 1000, easing: 'ease-out', fill: 'backwards' },
          );
          dealFlight.current = { anim, x, y: targetY };
        }
        return;
      }
      mx.jump(jump.x);
      my.jump(jump.y);
    }
    // Any new destination finishes a running deal flight at once (TAD §10.4).
    const flight = dealFlight.current;
    if (flight && (flight.x !== x || flight.y !== targetY)) {
      flight.anim.finish();
      dealFlight.current = null;
    }
    const opts = reduce ? { duration: 0 } : { duration: selected ? MOTION.lift : MOTION.move, ease: 'easeOut' as const };
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
      ref={el}
      className="card absolute top-0 left-0"
      style={{ x: mx, y: my, width: size.w, height: size.h, zIndex: z, opacity: hidden ? 0 : 1 }}
      data-card={card.id}
      aria-label={cardLabel(card)}
    >
      <motion.div className="absolute inset-0" style={{ x: shakeX }}>
        {/* Flip: a CSS animation on a fresh element whenever the face changes after mount.
            It runs on the compositor and leaves no 3D transform behind (no per-card 3D layers). */}
        {revealing && (
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: size.radius }}>
            <CardFace card={{ ...card, faceUp: false }} size={size} backSrc={backSrc} faces={faces} />
          </div>
        )}
        <div
          key={`${card.faceUp}-${revealing ? seenDeal : ''}`}
          className={`absolute inset-0 overflow-hidden ${(animateFlip || revealing) && !reduce ? 'card-flip' : ''}`}
          style={{
            borderRadius: size.radius,
            boxShadow: selected ? '0 6px 14px rgba(0,0,0,0.45)' : undefined,
            // While dealing, the face waits edge-on (invisible, back showing) until the card lands.
            ...(revealing ? { animationDelay: `${dealReveal}s`, animationFillMode: 'backwards' } : {}),
          }}
        >
          <CardFace card={card} size={size} backSrc={backSrc} faces={faces} />
        </div>
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
