import { ArrowPathIcon, ArrowUturnLeftIcon, EyeIcon } from '@heroicons/react/24/outline';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CARD_BACKS, CARD_FACES, DEFAULTS, pick, THEMES } from '../assets/registry';
import { FOUNDATION_SUITS } from '../engine/constants';
import { autoFoundationTarget, canPickUp, pileAt, sameRef } from '../engine/rules';
import { canUndo } from '../engine/selectors';
import type { Card, PileRef } from '../engine/types';
import { computeLayout, type CardPlacement, type LayoutResult, type Metrics, type Rect } from '../layout';
import { useGameStore } from '../store/gameStore';
import {
  cardAtPoint,
  DOUBLE_TAP_MS,
  DRAG_THRESHOLD,
  isDestination,
  landingRect,
  legalDestinations,
  pickDropTarget,
  pileAtPoint,
} from './boardInput';
import { CroppedPreview, PREVIEW_ASPECT } from './CroppedPreview';
import { CardFace, cardLabel, CardView, MOTION, type CardSize, type Jump } from './CardView';
import { pileName } from './format';
import { ControlButton } from './controls';
import { PeekPanel } from './PeekPanel';
import { SuitIcon } from './SuitIcon';

const box = (r: Rect): React.CSSProperties => ({ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h });

interface Selection {
  readonly from: PileRef;
  readonly cardIndex: number;
}

interface Press {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly card: CardPlacement | null;
  readonly pickable: boolean;
  /** Folded bundle pressed, if any (read at pointerdown: pointer capture retargets pointerup). */
  readonly bundle: number | null;
}

interface Drag {
  readonly from: PileRef;
  readonly cardIndex: number;
  readonly ids: readonly string[];
  /** Where the lead card started (board coords). */
  readonly originX: number;
  readonly originY: number;
  /** Pointer offset inside the lead card. */
  readonly grabX: number;
  readonly grabY: number;
  readonly x: number;
  readonly y: number;
  /** Springing back after an illegal drop. */
  readonly returning: boolean;
}

let jumpNonce = 1;

/** Seconds to wait before the deal on a cold launch. */
const FIRST_DEAL_DELAY = 0.25;

/**
 * Deal animation: every tableau card flies in from the stock, 25 ms apart (TAD §10.4).
 * Every other card (the new stock) is a zero-length "deal" that just places it, so nothing slides.
 */
function dealJumps(layout: LayoutResult, startDelay = 0): Record<string, Jump> {
  const { stock } = layout.slots;
  const jumps: Record<string, Jump> = {};
  const nonce = jumpNonce++;
  for (const c of layout.cards) if (c.pile.kind !== 'tableau') jumps[c.id] = { x: c.x, y: c.y, nonce, delay: 0 };
  layout.cards
    .filter((c) => c.pile.kind === 'tableau')
    .sort((a, b) => a.index - b.index || (a.pile.kind === 'tableau' && b.pile.kind === 'tableau' ? a.pile.index - b.pile.index : 0))
    .forEach((c, i) => {
      jumps[c.id] = { x: stock.x, y: stock.y, nonce, delay: startDelay + i * 0.025 };
    });
  return jumps;
}

/** Memoised: the board re-renders only when the game, settings or screen size change. */
export const Board = memo(function Board({ metrics }: { metrics: Metrics }) {
  const game = useGameStore((s) => s.session.game);
  const settings = useGameStore((s) => s.settings);
  const dealId = useGameStore((s) => s.dealId);
  const animateDeal = useGameStore((s) => s.animateDeal);
  const restartGame = useGameStore((s) => s.restartGame);
  const dispatch = useGameStore((s) => s.dispatch);
  const board = game.board;

  const layout = useMemo(() => computeLayout(board, metrics), [board, metrics]);
  const back = pick(CARD_BACKS, settings.cardBackId, DEFAULTS.back);
  const faces = pick(CARD_FACES, settings.cardFaceId, DEFAULTS.face);
  const theme = pick(THEMES, settings.themeId, DEFAULTS.theme);

  const cardById = useMemo(() => {
    const map = new Map<string, Card>();
    const { stock, waste, foundations, tableau } = board;
    for (const c of [...stock, ...waste, ...foundations.flat(), ...tableau.flat()]) map.set(c.id, c);
    return map;
  }, [board]);

  const [rawSelection, setSelection] = useState<{ sel: Selection; board: typeof board } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [jumps, setJumps] = useState<Record<string, Jump>>({});
  const [shakes, setShakes] = useState<Record<string, number>>({});
  const [peekPile, setPeekPile] = useState<number | null>(null);
  const [dealSeen, setDealSeen] = useState<number | null>(null);
  /** Polite screen-reader message; a trailing no-break space makes repeats re-announce. */
  const [announcement, setAnnouncement] = useState('');
  const say = (msg: string) => setAnnouncement((m) => (m === msg ? `${msg}\u00a0` : msg));
  const press = useRef<Press | null>(null);
  const lastTap = useRef<{ id: string; time: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // A new deal (new game or restart): play the deal animation and drop any selection.
  if (dealSeen !== dealId) {
    setDealSeen(dealId);
    // On first launch, hold the deal a moment so it doesn't overlap the app's first paint.
    setJumps(animateDeal ? dealJumps(layout, dealSeen === null ? FIRST_DEAL_DELAY : 0) : {});
    setSelection(null);
    setDrag(null);
    setPeekPile(null);
  }

  // A selection only survives while the board it was made on is current.
  const selection = rawSelection && rawSelection.board === board ? rawSelection.sel : null;
  const won = game.status === 'won';

  // Stable object, so the memoised cards skip re-rendering when only other cards change.
  const size: CardSize = useMemo(
    () => ({ w: metrics.cardW, h: metrics.cardH, radius: metrics.radius, rankFont: metrics.rankFont }),
    [metrics.cardW, metrics.cardH, metrics.radius, metrics.rankFont],
  );
  const { slots } = layout;

  const runIds = (from: PileRef, cardIndex: number) => (pileAt(board, from) ?? []).slice(cardIndex).map((c) => c.id);
  const selectedIds = new Set(selection ? runIds(selection.from, selection.cardIndex) : []);
  /** The card the player tapped (the top of a selected run). */
  const selectedCard = selection ? pileAt(board, selection.from)?.[selection.cardIndex] : undefined;
  const draggedIds = new Set(drag?.ids ?? []);

  const active = drag && !drag.returning ? drag : selection;
  const highlights = active ? legalDestinations(board, layout, active.from, active.cardIndex) : [];

  const shakeIds = (ids: readonly string[]) =>
    setShakes((s) => {
      const next = { ...s };
      for (const id of ids) next[id] = (next[id] ?? 0) + 1;
      return next;
    });

  const move = (from: PileRef, cardIndex: number, to: PileRef, jumpFrom?: { x: number; y: number }) => {
    const ids = runIds(from, cardIndex);
    const lead = (pileAt(board, from) ?? [])[cardIndex];
    const result = dispatch({ type: 'MOVE', from, cardIndex, to });
    if (result.ok && lead) say(`${cardLabel(lead)}${ids.length > 1 ? ` and ${ids.length - 1} more` : ''} to ${pileName(to)}`);
    if (result.ok && jumpFrom) {
      const nonce = jumpNonce++;
      setJumps((j) => {
        const next = { ...j };
        ids.forEach((id, i) => (next[id] = { x: jumpFrom.x, y: jumpFrom.y + i * metrics.offsets.up, nonce }));
        return next;
      });
    }
    return result.ok;
  };

  const select = (sel: Selection | null) => setSelection(sel ? { sel, board } : null);

  const tapStock = () => {
    select(null);
    if (board.stock.length === 0) {
      if (dispatch({ type: 'RECYCLE' }).ok) say('Waste turned back into the stock');
      return;
    }
    const r = dispatch({ type: 'DRAW' });
    const drawn = r.ok ? r.state.board.waste.at(-1) : undefined;
    if (drawn) say(`Drew ${cardLabel(drawn)}`);
  };

  // ---------------------------------------------------------------- keyboard and screen-reader play
  // Each pile has an invisible focusable button (pointer-events: none, so touch is unaffected).
  // Enter/Space selects the top card; pressing again on the same pile reaches one card further
  // down the run; Enter on another pile moves there. F sends to the foundation, Escape cancels.

  const activatePile = (ref: PileRef) => {
    if (won) return;
    const pile = pileAt(board, ref) ?? [];
    if (selection && !sameRef(selection.from, ref)) {
      if (move(selection.from, selection.cardIndex, ref)) select(null);
      else {
        shakeIds(runIds(selection.from, selection.cardIndex));
        say(`Can't move there`);
        select(null);
      }
      return;
    }
    const start = selection ? selection.cardIndex - 1 : pile.length - 1;
    const lead = pile[start];
    if (lead && canPickUp(board, ref, start)) {
      select({ from: ref, cardIndex: start });
      const n = pile.length - start;
      say(`Selected ${cardLabel(lead)}${n > 1 ? ` and ${n - 1} more` : ''}`);
    } else {
      select(null);
      if (selection) say('Selection cleared');
    }
  };

  const sendToFoundation = (ref: PileRef) => {
    const pile = pileAt(board, ref) ?? [];
    const idx = selection && sameRef(selection.from, ref) ? selection.cardIndex : pile.length - 1;
    const to = idx >= 0 ? autoFoundationTarget(board, ref, idx) : null;
    select(null);
    if (!to || !move(ref, idx, to)) say(`Can't go to a foundation`);
  };

  const onPileKey = (ref: PileRef) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activatePile(ref);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      sendToFoundation(ref);
    } else if (e.key === 'Escape' && selection) {
      e.stopPropagation();
      select(null);
      say('Selection cleared');
    }
  };

  const describePile = (ref: PileRef): string => {
    const pile = pileAt(board, ref) ?? [];
    const name = pileName(ref);
    const label = name[0]!.toUpperCase() + name.slice(1);
    if (pile.length === 0) return `${label}, empty`;
    if (ref.kind !== 'tableau') return `${label}, ${cardLabel(pile[pile.length - 1]!)}${ref.kind === 'waste' ? '' : ` on top`}`;
    const down = pile.filter((c) => !c.faceUp).length;
    const up = pile.filter((c) => c.faceUp);
    const run = up.length > 1 ? `${cardLabel(up[0]!)} down to ${cardLabel(up[up.length - 1]!)}` : cardLabel(up[0]!);
    return `${label}, ${down ? `${down} face-down, ` : ''}${run}`;
  };

  const pileButtonRect = (ref: PileRef): Rect => {
    const pile = pileAt(board, ref) ?? [];
    const top = layout.cards.find((c) => sameRef(c.pile, ref) && c.index === pile.length - 1);
    if (top) return { x: top.x, y: top.y, w: metrics.cardW, h: metrics.cardH };
    if (ref.kind === 'tableau') return slots.tableau[ref.index]!.rect;
    if (ref.kind === 'foundation') return slots.foundations[ref.index]!;
    return slots.waste;
  };

  const pileRefs: PileRef[] = [
    ...FOUNDATION_SUITS.map((_, index) => ({ kind: 'foundation' as const, index })),
    ...Array.from({ length: 7 }, (_, index) => ({ kind: 'tableau' as const, index })),
    { kind: 'waste' },
  ];

  // ---------------------------------------------------------------- pointer handling

  const toBoard = (e: React.PointerEvent) => {
    const r = boardRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (won || peekPile !== null || drag) return;
    const target = e.target as HTMLElement;
    if (target.closest('.control')) return;
    const { x, y } = toBoard(e);
    const bundleAttr = target.closest<HTMLElement>('[data-bundle]')?.dataset.bundle;
    const bundle = bundleAttr === undefined ? null : Number(bundleAttr);
    const card = bundle !== null ? null : cardAtPoint(layout, x, y);
    const pickable = !!card && canPickUp(board, card.pile, card.index);
    press.current = { pointerId: e.pointerId, startX: x, startY: y, card, pickable, bundle };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    const { x, y } = toBoard(e);
    if (drag && !drag.returning) {
      setDrag({ ...drag, x: x - drag.grabX, y: y - drag.grabY });
      return;
    }
    if (!drag && p.pickable && p.card && Math.hypot(x - p.startX, y - p.startY) > DRAG_THRESHOLD) {
      const c = p.card;
      select(null);
      setDrag({
        from: c.pile,
        cardIndex: c.index,
        ids: runIds(c.pile, c.index),
        originX: c.x,
        originY: c.y,
        grabX: p.startX - c.x,
        grabY: p.startY - c.y,
        x: x - (p.startX - c.x),
        y: y - (p.startY - c.y),
        returning: false,
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    press.current = null;
    if (drag && !drag.returning) {
      const lead: Rect = { x: drag.x, y: drag.y, w: metrics.cardW, h: metrics.cardH };
      const to = pickDropTarget(board, layout, drag.from, drag.cardIndex, lead);
      if (to && move(drag.from, drag.cardIndex, to, { x: drag.x, y: drag.y })) setDrag(null);
      else setDrag({ ...drag, returning: true });
      return;
    }
    const { x, y } = toBoard(e);
    handleTap(p, x, y);
  };

  const onPointerCancel = () => {
    press.current = null;
    if (drag && !drag.returning) setDrag({ ...drag, returning: true });
  };

  const handleTap = ({ card, bundle }: Press, x: number, y: number) => {
    // Stock: deal one, or recycle when empty.
    const inStock = x >= slots.stock.x && x <= slots.stock.x + slots.stock.w && y >= slots.stock.y && y <= slots.stock.y + slots.stock.h;
    if (inStock) {
      tapStock();
      return;
    }
    // Folded bundle: open the peek panel.
    if (bundle !== null) {
      setPeekPile(bundle);
      select(null);
      return;
    }

    const now = performance.now();
    const pickable = !!card && canPickUp(board, card.pile, card.index);

    // Double-tap: send the card to its foundation if that is legal (U9).
    if (card && lastTap.current?.id === card.id && now - lastTap.current.time < DOUBLE_TAP_MS) {
      lastTap.current = null;
      const to = autoFoundationTarget(board, card.pile, card.index);
      select(null);
      if (to) move(card.pile, card.index, to);
      else if (pickable) {
        shakeIds([card.id]);
        say(`Can't go to a foundation`);
      }
      return;
    }
    lastTap.current = card ? { id: card.id, time: now } : null;

    if (selection) {
      if (card && sameRef(card.pile, selection.from) && card.index === selection.cardIndex) {
        select(null);
        return;
      }
      const dest = card && isDestination(card.pile) ? card.pile : pileAtPoint(layout, x, y);
      if (dest && !sameRef(dest, selection.from)) {
        if (move(selection.from, selection.cardIndex, dest)) {
          select(null);
          return;
        }
        if (!pickable) {
          shakeIds(runIds(selection.from, selection.cardIndex));
          say(`Can't move there`);
          select(null);
          return;
        }
      }
    }
    select(pickable && card ? { from: card.pile, cardIndex: card.index } : null);
  };

  const finishReturn = () => {
    if (!drag) return;
    shakeIds(drag.ids);
    setDrag(null);
  };

  // ---------------------------------------------------------------- render

  const slotStyle = { borderRadius: metrics.radius };

  return (
    <div
      ref={boardRef}
      className="relative mx-auto touch-none select-none"
      style={{ width: metrics.boardW, height: metrics.boardH }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      data-testid="board"
    >
      {/* Foundation placeholders: muted suit symbols in fixed slots (U7). */}
      {slots.foundations.map((r, i) => (
        <div
          key={`f${i}`}
          className="flex items-center justify-center border border-border bg-surface/70 text-text-muted"
          style={{ ...box(r), ...slotStyle }}
          data-pile={`foundation-${i}`}
        >
          <SuitIcon suit={FOUNDATION_SUITS[i]!} size={Math.round(metrics.cardW * 0.45)} />
        </div>
      ))}

      {slots.tableau.map((s, p) =>
        board.tableau[p]?.length ? null : (
          <div key={`t${p}`} className="border border-border/70" style={{ ...box(s.rect), ...slotStyle }} data-pile={`tableau-${p}`} />
        ),
      )}

      <div className="bg-surface/80" style={{ ...box(slots.waste), ...slotStyle }} />

      {pileRefs.map((ref) => {
        const selectedHere = !!selection && sameRef(selection.from, ref);
        return (
          <button
            key={`k-${ref.kind}-${'index' in ref ? ref.index : ''}`}
            type="button"
            tabIndex={won ? -1 : 0}
            aria-label={describePile(ref)}
            aria-pressed={selectedHere}
            onKeyDown={onPileKey(ref)}
            className="pointer-events-none absolute z-[600] rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/60"
            style={{ ...box(pileButtonRect(ref)), ...slotStyle }}
            data-pile-key={`${ref.kind}${'index' in ref ? `-${ref.index}` : ''}`}
          />
        );
      })}
      <div
        role="button"
        tabIndex={0}
        aria-label={board.stock.length ? `Stock, ${board.stock.length} ${board.stock.length === 1 ? "card" : "cards"}. Draw a card` : 'Stock, empty. Turn the waste back over'}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          tapStock();
        }}
        className="flex items-center justify-center border border-border/70 text-text-muted focus-visible:outline-2 focus-visible:outline-white"
        style={{ ...box(slots.stock), ...slotStyle }}
        data-testid="stock"
      >
        {board.waste.length > 0 && <ArrowPathIcon className="size-7" strokeWidth={1.5} aria-hidden="true" />}
      </div>

      {/* Valid destinations get a subtle highlight (Style Guide 6.1). */}
      {highlights.map((ref) => {
        const r = landingRect(layout, ref);
        return r ? (
          <div
            key={`h-${ref.kind}-${'index' in ref ? ref.index : ''}`}
            className="pointer-events-none absolute z-[250] ring-2 ring-white/45"
            style={{ ...box(r), ...slotStyle }}
          />
        ) : null;
      })}

      {layout.cards.map((p) => {
        const card = cardById.get(p.id);
        if (!card) return null;
        const base = p.pile.kind === 'tableau' ? 100 : 10;
        return (
          <CardView
            key={p.id}
            card={card}
            x={p.x}
            y={p.y}
            z={base + p.z + (selectedIds.has(p.id) ? 100 : 0)}
            size={size}
            backSrc={back.src}
            faces={faces}
            selected={selectedIds.has(p.id)}
            outlined={!!selection && sameRef(p.pile, selection.from) && p.index === selection.cardIndex}
            hidden={draggedIds.has(p.id)}
            jump={jumps[p.id]}
            shake={shakes[p.id]}
          />
        );
      })}

      {/* Folded-run badges (TAD §9.4): tap to peek at the whole column. */}
      {layout.bundles.map((b) => {
        const h = Math.max(b.rect.h, 28);
        return (
          <div
            key={`b${b.pile}`}
            data-bundle={b.pile}
            aria-label={`Show ${b.count} folded cards`}
            className="absolute z-[300] flex items-center justify-center"
            style={box({ ...b.rect, h, y: b.rect.y + b.rect.h / 2 - h / 2 })}
          >
            <span className="rounded-full bg-surface-elevated px-sm py-px text-xs font-semibold text-text-primary shadow">
              +{b.count}
            </span>
          </div>
        );
      })}

      {drag && (
        <DragLayer drag={drag} cards={drag.ids.map((id) => cardById.get(id)!)} size={size} offset={metrics.offsets.up} backSrc={back.src} faces={faces} onReturned={finishReturn} />
      )}

      {/* While a card is selected, the Appearance button becomes an eye that opens it large. */}
      {selectedCard ? (
        <ControlButton
          label="Inspect card"
          icon={EyeIcon}
          onClick={() => useGameStore.getState().inspect(selectedCard.id)}
          style={{ ...box(slots.appearance), zIndex: 400 }}
        />
      ) : (
        <ControlButton label="Appearance" onClick={() => useGameStore.getState().openModal('appearance')} style={{ ...box(slots.appearance), zIndex: 400 }}>
          <CroppedPreview aspect={PREVIEW_ASPECT.theme} background={theme.preview} className="size-7 ring-1 ring-white/40" />
        </ControlButton>
      )}
      <ControlButton
        label="Undo"
        icon={ArrowUturnLeftIcon}
        disabled={!canUndo(game)}
        onClick={() => {
          select(null);
          dispatch({ type: 'UNDO' });
        }}
        style={{ ...box(slots.undo), zIndex: 400 }}
      />
      <ControlButton label="Restart" icon={ArrowPathIcon} onClick={restartGame} style={{ ...box(slots.restart), zIndex: 400 }} />

      {peekPile !== null && (
        <PeekPanel
          cards={board.tableau[peekPile] ?? []}
          metrics={metrics}
          size={size}
          backSrc={back.src}
          faces={faces}
          onPick={(cardIndex) => {
            const from: PileRef = { kind: 'tableau', index: peekPile };
            setPeekPile(null);
            if (canPickUp(board, from, cardIndex)) select({ from, cardIndex });
          }}
          onClose={() => setPeekPile(null)}
        />
      )}

      <div className="sr-only" aria-live="polite" data-testid="announcer">
        {announcement}
      </div>
    </div>
  );
});

/** The picked-up run, fanned downward under the finger whichever stack it came from (TAD §10.1). */
function DragLayer({
  drag,
  cards,
  size,
  offset,
  backSrc,
  faces,
  onReturned,
}: {
  drag: Drag;
  cards: readonly Card[];
  size: CardSize;
  offset: number;
  backSrc: string;
  faces: Parameters<typeof CardFace>[0]['faces'];
  onReturned: () => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(drag.x);
  const y = useMotionValue(drag.y);
  const done = useRef(onReturned);
  useLayoutEffect(() => {
    done.current = onReturned;
  });

  useLayoutEffect(() => {
    if (!drag.returning) {
      x.jump(drag.x);
      y.jump(drag.y);
      return;
    }
    const opts = { duration: reduce ? 0 : MOTION.move, ease: 'easeOut' as const };
    const a = animate(x, drag.originX, opts);
    const b = animate(y, drag.originY, { ...opts, onComplete: () => done.current() });
    return () => {
      a.stop();
      b.stop();
    };
  }, [drag, reduce, x, y]);

  return (
    <motion.div className="pointer-events-none absolute top-0 left-0 z-[1000]" style={{ x, y, scale: drag.returning ? 1 : 1.04, transformOrigin: 'top left' }}>
      {cards.map((card, i) => (
        <div
          key={card.id}
          className="absolute overflow-hidden"
          style={{ top: i * offset, width: size.w, height: size.h, borderRadius: size.radius, boxShadow: '0 10px 24px rgba(0,0,0,0.5)' }}
        >
          <CardFace card={card} size={size} backSrc={backSrc} faces={faces} />
        </div>
      ))}
    </motion.div>
  );
}
