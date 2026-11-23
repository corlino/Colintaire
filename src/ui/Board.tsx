import { ArrowPathIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';
import { CARD_BACKS, CARD_FACES, DEFAULTS, pick, THEMES } from '../assets/registry';
import { FOUNDATION_SUITS } from '../engine/constants';
import { canUndo } from '../engine/selectors';
import type { Card } from '../engine/types';
import { computeLayout, type Metrics, type Rect } from '../layout';
import { useGameStore } from '../store/gameStore';
import { CardView, type CardSize } from './CardView';
import { ControlButton } from './controls';
import { SuitIcon } from './SuitIcon';

const box = (r: Rect): React.CSSProperties => ({ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h });

export function Board({ metrics }: { metrics: Metrics }) {
  const game = useGameStore((s) => s.session.game);
  const settings = useGameStore((s) => s.settings);
  const restartGame = useGameStore((s) => s.restartGame);
  const dispatch = useGameStore((s) => s.dispatch);

  const layout = useMemo(() => computeLayout(game.board, metrics), [game.board, metrics]);
  const back = pick(CARD_BACKS, settings.cardBackId, DEFAULTS.back);
  const faces = pick(CARD_FACES, settings.cardFaceId, DEFAULTS.face);
  const theme = pick(THEMES, settings.themeId, DEFAULTS.theme);

  const cardById = useMemo(() => {
    const map = new Map<string, Card>();
    const { stock, waste, foundations, tableau } = game.board;
    for (const c of [...stock, ...waste, ...foundations.flat(), ...tableau.flat()]) map.set(c.id, c);
    return map;
  }, [game.board]);

  const size: CardSize = { w: metrics.cardW, h: metrics.cardH, radius: metrics.radius, rankFont: metrics.rankFont };
  const slotRadius = { borderRadius: metrics.radius };
  const { slots } = layout;

  return (
    <div className="relative mx-auto touch-none select-none" style={{ width: metrics.boardW, height: metrics.boardH }}>
      {/* Foundation placeholders: muted suit symbols in fixed slots (U7). */}
      {slots.foundations.map((r, i) => (
        <div key={`f${i}`} className="flex items-center justify-center border border-border bg-surface/70 text-text-muted" style={{ ...box(r), ...slotRadius }}>
          <SuitIcon suit={FOUNDATION_SUITS[i]!} size={Math.round(metrics.cardW * 0.45)} />
        </div>
      ))}

      {/* Empty tableau outlines. */}
      {slots.tableau.map((s, p) =>
        game.board.tableau[p]?.length ? null : (
          <div key={`t${p}`} className="border border-border/70" style={{ ...box(s.rect), ...slotRadius }} />
        ),
      )}

      {/* Waste and stock beds. */}
      <div className="bg-surface/80" style={{ ...box(slots.waste), ...slotRadius }} />
      <button
        type="button"
        aria-label={game.board.stock.length ? 'Draw a card' : 'Recycle the waste pile'}
        onClick={() => dispatch(game.board.stock.length ? { type: 'DRAW' } : { type: 'RECYCLE' })}
        className="flex items-center justify-center border border-border/70 text-text-muted"
        style={{ ...box(slots.stock), ...slotRadius }}
      >
        {game.board.waste.length > 0 && <ArrowPathIcon className="size-7" strokeWidth={1.5} aria-hidden="true" />}
      </button>

      {layout.cards.map((p) => {
        const card = cardById.get(p.id);
        if (!card) return null;
        const base = p.pile.kind === 'tableau' ? 100 : 10;
        return <CardView key={p.id} card={card} x={p.x} y={p.y} z={base + p.z} size={size} backSrc={back.src} faces={faces} />;
      })}

      {/* Folded-run badges (TAD §9.4). Tapping opens the peek panel in M4. */}
      {layout.bundles.map((b) => (
        <div key={`b${b.pile}`} className="pointer-events-none absolute z-[300] flex items-center justify-center" style={box({ ...b.rect, h: Math.max(b.rect.h, 16), y: b.rect.y + b.rect.h / 2 - Math.max(b.rect.h, 16) / 2 })}>
          <span className="rounded-full bg-surface-elevated px-sm py-px text-xs font-semibold text-text-primary shadow">+{b.count}</span>
        </div>
      ))}

      {/* Controls. */}
      <ControlButton
        label="Appearance"
        style={{ ...box(slots.appearance), zIndex: 400 }}
      >
        <span className="block size-7 rounded-full ring-1 ring-white/40" style={{ background: theme.preview }} aria-hidden="true" />
      </ControlButton>
      <ControlButton
        label="Undo"
        icon={ArrowUturnLeftIcon}
        disabled={!canUndo(game)}
        onClick={() => dispatch({ type: 'UNDO' })}
        style={{ ...box(slots.undo), zIndex: 400 }}
      />
      <ControlButton label="Restart" icon={ArrowPathIcon} onClick={restartGame} style={{ ...box(slots.restart), zIndex: 400 }} />
    </div>
  );
}
