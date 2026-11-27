import { useState } from 'react';
import { RESHUFFLE_MARK } from '../../assets/registry';
import { useGameStore } from '../../store/gameStore';
import { randomQuote } from '../quotes';
import { ModalShell } from './ModalShell';

/**
 * Confirm before reshuffling (owner reference): mask, Confirm, and a random quote.
 * Classic replays the same deal and Vegas deals afresh for $52; Trini shuffles
 * only the tableau and the game carries on.
 */
export function ReshuffleModal() {
  const mode = useGameStore((s) => s.session.game.mode);
  const { closeModal, restartGame, reshuffleTableau } = useGameStore.getState();
  const [quote] = useState(() => randomQuote()); // fixed while open

  return (
    <ModalShell title="Reshuffle" onClose={closeModal}>
      <div className="flex flex-1 flex-col items-center">
        {RESHUFFLE_MARK && (
          <img
            src={RESHUFFLE_MARK.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="mt-lg h-24 w-auto select-none"
            style={{ aspectRatio: String(RESHUFFLE_MARK.aspect) }}
          />
        )}
        <button
          type="button"
          onClick={mode === 'trini' ? reshuffleTableau : restartGame}
          className="mt-2xl w-full rounded-md border border-border bg-black py-lg text-button text-text-primary active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-white"
        >
          Confirm
        </button>
        {mode === 'vegas' && <p className="mt-md text-center text-text-secondary">Costs $52 to deal</p>}
        {mode === 'trini' && <p className="mt-md text-center text-text-secondary">Only cards in the tableau are affected</p>}
        <figure className="mt-2xl max-w-[400px] text-center">
          <blockquote className="text-instruction">&ldquo;{quote.text}&rdquo;</blockquote>
          <figcaption className="mt-lg text-instruction font-normal text-text-secondary">{quote.author}</figcaption>
        </figure>
      </div>
    </ModalShell>
  );
}
