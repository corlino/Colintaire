import { useState } from 'react';
import type { GameMode } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { vegasBalance } from '../../store/session';
import { formatVegas } from '../format';
import { ModalShell } from './ModalShell';

/** Two-option segmented selector — never an on/off toggle (Style Guide 7.3). */
function ModeSelector({ value, onChange }: { value: GameMode; onChange: (m: GameMode) => void }) {
  const options: { mode: GameMode; label: string }[] = [
    { mode: 'classic', label: 'Classic' },
    { mode: 'vegas', label: 'Vegas' },
    { mode: 'trini', label: 'Trini' },
  ];
  return (
    <div role="radiogroup" aria-label="Game mode" className="flex rounded-lg bg-black p-xs">
      {options.map(({ mode, label }) => {
        const selected = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(mode)}
            className={`flex-1 rounded-md py-md text-button transition-colors duration-(--duration-fast) motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-white ${
              selected ? 'bg-surface-elevated text-text-primary' : 'text-text-secondary'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * New Game (PRD 6.3, 8.2). The mode choice is local state: closing without
 * Confirm changes nothing. Reset balance is the one action that applies here (U14).
 */
export function NewGameModal() {
  const lastMode = useGameStore((s) => s.settings.lastMode);
  const balance = useGameStore((s) => vegasBalance(s.session));
  const { closeModal, startNewGame, resetBalance } = useGameStore.getState();
  const [mode, setMode] = useState<GameMode>(lastMode); // U17: remembers the last mode
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <ModalShell title="New Game" onClose={closeModal}>
      <p className="mx-auto mt-lg max-w-[340px] text-center text-instruction">
        Select a game mode then press confirm to start a new game.
      </p>
      <div className="mt-2xl">
        <ModeSelector value={mode} onChange={setMode} />
      </div>
      {mode === 'vegas' && <p className="mt-md text-center text-text-secondary">Costs $52 to deal. Each card on a foundation pays $5.</p>}
      {mode === 'trini' && (
        <p className="mt-md text-center text-text-secondary">Trini mode is like Classic mode, but lets Trini reshuffle when she gets stuck.</p>
      )}
      <button
        type="button"
        onClick={() => startNewGame(mode)}
        className="mt-xl w-full rounded-md bg-black py-lg text-button text-text-primary active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-white"
      >
        Confirm
      </button>

      {balance !== 0 && !confirmingReset && (
        <button type="button" onClick={() => setConfirmingReset(true)} className="mt-xl self-center py-sm text-text-secondary underline-offset-4 hover:underline">
          Reset Vegas balance ({formatVegas(balance)})
        </button>
      )}
      {confirmingReset && (
        <div className="mt-xl flex flex-col items-center gap-md" role="group" aria-label="Confirm balance reset">
          <p className="text-text-primary">Reset to $0? This can&rsquo;t be undone.</p>
          <div className="flex gap-md">
            <button type="button" onClick={() => setConfirmingReset(false)} className="rounded-md bg-surface-elevated px-xl py-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                resetBalance();
                setConfirmingReset(false);
              }}
              className="rounded-md bg-black px-xl py-sm font-semibold"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
