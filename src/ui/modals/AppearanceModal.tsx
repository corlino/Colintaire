import { CARD_BACKS, DEFAULTS, pick, THEMES } from '../../assets/registry';
import { useGameStore } from '../../store/gameStore';
import { ModalShell } from './ModalShell';

/** Circular swatch with a 2 px white ring and 3 px gap when selected (TAD §12.4). */
function Swatch({ label, selected, background, onSelect }: { label: string; selected: boolean; background: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={`size-16 rounded-full p-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        selected ? 'ring-2 ring-white' : ''
      }`}
    >
      <span className="block size-full rounded-full" style={{ background, backgroundSize: 'cover', backgroundPosition: 'center' }} />
    </button>
  );
}

/**
 * Appearance (PRD 7.3). One row per registry; options apply immediately.
 * Phase 1 shows exactly one of each — unavailable options are never shown.
 */
export function AppearanceModal() {
  const settings = useGameStore((s) => s.settings);
  const { closeModal, setTheme, setCardBack } = useGameStore.getState();
  const theme = pick(THEMES, settings.themeId, DEFAULTS.theme);
  const back = pick(CARD_BACKS, settings.cardBackId, DEFAULTS.back);

  return (
    <ModalShell title="Appearance" onClose={closeModal}>
      <section className="mt-lg flex flex-col items-center gap-lg" aria-label="Interface Theme">
        <h3 className="text-section">Interface Theme</h3>
        <div role="radiogroup" aria-label="Interface Theme" className="flex flex-wrap justify-center gap-xl">
          {THEMES.map((t) => (
            <Swatch key={t.id} label={t.name} selected={t.id === theme.id} background={t.preview} onSelect={() => setTheme(t.id)} />
          ))}
        </div>
      </section>
      <section className="mt-2xl flex flex-col items-center gap-lg" aria-label="Card Style">
        <h3 className="text-section">Card Style</h3>
        <div role="radiogroup" aria-label="Card Style" className="flex flex-wrap justify-center gap-xl">
          {CARD_BACKS.map((b) => (
            <Swatch key={b.id} label={b.name} selected={b.id === back.id} background={`url("${b.src}")`} onSelect={() => setCardBack(b.id)} />
          ))}
        </div>
      </section>
      <p className="mt-auto pt-2xl text-center text-xs text-text-muted" data-testid="app-version">{__APP_VERSION__}</p>
    </ModalShell>
  );
}
