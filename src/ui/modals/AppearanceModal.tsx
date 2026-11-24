import { CARD_BACKS, CARD_FACES, DEFAULTS, pick, THEMES } from '../../assets/registry';
import type { Card } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { CardFace, type CardSize } from '../CardView';
import { CroppedPreview, PREVIEW_ASPECT } from '../CroppedPreview';
import { ModalShell } from './ModalShell';

/** Circular swatch with a 2 px white ring and 3 px gap when selected (TAD §12.4). */
function Swatch({ label, selected, onSelect, children }: { label: string; selected: boolean; onSelect: () => void; children: React.ReactNode }) {
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
      {children}
    </button>
  );
}

/** Face sets are previewed by their Ace of Spades, drawn the same way the board draws it. */
const PREVIEW_CARD: Card = { id: 'S01', suit: 'S', rank: 1, faceUp: true };
const PREVIEW_SIZE: CardSize = { w: 58, h: 81, radius: 0, rankFont: 13 };

/**
 * Appearance (PRD 7.3). One row per registry; options apply immediately.
 * Phase 1 shows exactly one of each — unavailable options are never shown.
 */
export function AppearanceModal() {
  const settings = useGameStore((s) => s.settings);
  const { closeModal, setTheme, setCardBack, setCardFace } = useGameStore.getState();
  const theme = pick(THEMES, settings.themeId, DEFAULTS.theme);
  const back = pick(CARD_BACKS, settings.cardBackId, DEFAULTS.back);
  const faces = pick(CARD_FACES, settings.cardFaceId, DEFAULTS.face);

  return (
    <ModalShell title="Appearance" onClose={closeModal}>
      <section className="mt-lg flex flex-col items-center gap-lg" aria-label="Interface Theme">
        <h3 className="text-section">Interface Theme</h3>
        <div role="radiogroup" aria-label="Interface Theme" className="flex flex-wrap justify-center gap-xl">
          {THEMES.map((t) => (
            <Swatch key={t.id} label={t.name} selected={t.id === theme.id} onSelect={() => setTheme(t.id)}>
              <CroppedPreview aspect={PREVIEW_ASPECT.theme} background={t.preview} className="size-full" />
            </Swatch>
          ))}
        </div>
      </section>
      <section className="mt-2xl flex flex-col items-center gap-lg" aria-label="Card Style">
        <h3 className="text-section">Card Style</h3>
        <div role="radiogroup" aria-label="Card Style" className="flex flex-wrap justify-center gap-xl">
          {CARD_BACKS.map((b) => (
            <Swatch key={b.id} label={b.name} selected={b.id === back.id} onSelect={() => setCardBack(b.id)}>
              <CroppedPreview aspect={PREVIEW_ASPECT.card} src={b.src} className="size-full" />
            </Swatch>
          ))}
        </div>
      </section>
      <section className="mt-2xl flex flex-col items-center gap-lg" aria-label="Card Faces">
        <h3 className="text-section">Card Faces</h3>
        <div role="radiogroup" aria-label="Card Faces" className="flex flex-wrap justify-center gap-xl">
          {CARD_FACES.map((f) => (
            <Swatch key={f.id} label={f.name} selected={f.id === faces.id} onSelect={() => setCardFace(f.id)}>
              <CroppedPreview aspect={PREVIEW_ASPECT.card} className="size-full">
                <CardFace card={PREVIEW_CARD} size={PREVIEW_SIZE} backSrc={back.src} faces={f} />
              </CroppedPreview>
            </Swatch>
          ))}
        </div>
      </section>
      <p className="mt-auto pt-2xl text-center text-xs text-text-muted" data-testid="app-version">{__APP_VERSION__}</p>
    </ModalShell>
  );
}
