import { memo } from 'react';
import type { Card } from '../engine/types';
import type { CardFaceSet } from '../assets/registry';
import { colorOf } from '../engine/cards';
import { rankLabel, SUIT_NAME } from './format';
import { SuitIcon } from './SuitIcon';

export interface CardSize {
  readonly w: number;
  readonly h: number;
  readonly radius: number;
  readonly rankFont: number;
}

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

function ImageFace({ card, faces, radius }: { card: Card; faces: CardFaceSet; radius: number }) {
  const src = faces.images?.[card.id];
  return src ? <img src={src} alt="" className="absolute inset-0 h-full w-full" style={{ borderRadius: radius }} draggable={false} /> : null;
}

export interface CardViewProps {
  readonly card: Card;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: CardSize;
  readonly backSrc: string;
  readonly faces: CardFaceSet;
}

export const CardView = memo(function CardView({ card, x, y, z, size, backSrc, faces }: CardViewProps) {
  const name = `${rankLabel(card.rank)} of ${SUIT_NAME[card.suit]}`;
  return (
    <div
      className="card absolute top-0 left-0 overflow-hidden"
      style={{
        width: size.w,
        height: size.h,
        zIndex: z,
        borderRadius: size.radius,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
      data-card={card.id}
      aria-label={card.faceUp ? name : 'Face-down card'}
    >
      {card.faceUp ? (
        faces.kind === 'images' && faces.images?.[card.id] ? (
          <ImageFace card={card} faces={faces} radius={size.radius} />
        ) : (
          <ClassicFace card={card} size={size} />
        )
      ) : (
        <img src={backSrc} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
      )}
      <div className="pointer-events-none absolute inset-0 border border-card-border" style={{ borderRadius: size.radius }} />
    </div>
  );
});
