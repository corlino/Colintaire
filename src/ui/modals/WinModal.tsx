import { classicScore, gameNet } from '../../engine/selectors';
import { useGameStore } from '../../store/gameStore';
import { vegasBalance } from '../../store/session';
import { formatTime, formatVegas } from '../format';
import { ModalShell } from './ModalShell';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-md last:border-b-0">
      <span className="text-stat-label">{label}</span>
      <span className="text-stat-value">{value}</span>
    </div>
  );
}

/** Game completion (PRD 5.7): final stats; Vegas adds this game's net and the running balance. */
export function WinModal() {
  const session = useGameStore((s) => s.session);
  const timer = useGameStore((s) => s.timer);
  const { closeModal, openModal } = useGameStore.getState();
  const { game } = session;
  const vegas = game.mode === 'vegas';

  return (
    <ModalShell title="You Won" onClose={closeModal}>
      <p className="mt-lg text-center text-instruction">All four foundations are complete.</p>
      <div className="mt-xl rounded-lg bg-black px-lg py-xs">
        <Row label="Moves" value={String(game.moves)} />
        <Row label="Time" value={formatTime(timer.accumulatedMs / 1000)} />
        {vegas ? (
          <>
            <Row label="This game" value={formatVegas(gameNet(game))} />
            <Row label="Balance" value={formatVegas(vegasBalance(session))} />
          </>
        ) : (
          <Row label="Score" value={String(classicScore(game))} />
        )}
      </div>
      <button
        type="button"
        onClick={() => openModal('newGame')}
        className="mt-xl w-full rounded-md bg-black py-lg text-button text-text-primary active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-white"
      >
        New game
      </button>
    </ModalShell>
  );
}
