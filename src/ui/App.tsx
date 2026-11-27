import { AnimatePresence } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULTS, HEADER_LOGO, pick, THEMES } from '../assets/registry';
import { computeMetrics } from '../layout';
import { useGameStore } from '../store/gameStore';
import { Board } from './Board';
import { RotateOverlay } from './RotateOverlay';
import { AppearanceModal } from './modals/AppearanceModal';
import { InspectView } from './modals/InspectView';
import { NewGameModal } from './modals/NewGameModal';
import { ReshuffleModal } from './modals/ReshuffleModal';
import { WinModal } from './modals/WinModal';
import { SHELL } from './shellSizes';
import { StatsPanel } from './StatsPanel';

/** Measure an element's content box and keep it current. */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Theme only ever sets the background (Style Guide 3.2). */
function useThemeBackground() {
  const themeId = useGameStore((s) => s.settings.themeId);
  useEffect(() => {
    const theme = pick(THEMES, themeId, DEFAULTS.theme);
    const root = document.documentElement.style;
    root.setProperty('--app-bg-image', theme.background);
    root.setProperty('--app-bg-scrim', theme.scrim);
    root.setProperty('--app-bg-image-wide', theme.backgroundWide ?? theme.background);
  }, [themeId]);
}

/** Pause the timer while the page is hidden (TAD §11.3). */
function useVisibilityPause() {
  useEffect(() => {
    const sync = () => useGameStore.getState().setPaused('hidden', document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pagehide', sync);
    };
  }, []);
}

/** Crowned-club mark either side of the title (owner art, art/brand/logo-silver.png). */
function HeaderLogo() {
  if (!HEADER_LOGO) return null;
  return (
    <img
      src={HEADER_LOGO.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="mx-sm h-8 w-auto shrink-0 select-none min-[400px]:h-9"
      style={{ aspectRatio: String(HEADER_LOGO.aspect) }}
    />
  );
}

export function App() {
  useThemeBackground();
  useVisibilityPause();
  const [boardRef, area] = useSize<HTMLDivElement>();
  const metrics = useMemo(() => (area.width > 0 ? computeMetrics(area.width, area.height) : null), [area.width, area.height]);
  const activeModal = useGameStore((s) => s.activeModal);
  const openModal = useGameStore((s) => s.openModal);

  return (
    <div className="app-shell isolate flex h-full flex-col">
      <div className="mx-auto flex h-full w-full max-w-[520px] min-h-0 flex-col px-lg min-[400px]:px-[20px]">
        {/* With logos: logo · short line · title · short line · logo (owner reference). Without: lines fill the width. */}
        <header className="flex shrink-0 items-center gap-md" style={{ height: SHELL.header }}>
          {HEADER_LOGO && <HeaderLogo />}
          <span className={HEADER_LOGO ? 'flex flex-1 items-center justify-center gap-sm min-[360px]:gap-md min-[400px]:gap-lg' : 'contents'}>
            <span className={`h-px bg-divider ${HEADER_LOGO ? 'w-3 min-[360px]:w-5 min-[400px]:w-6' : 'flex-1'}`} />
            {/* Tapping the title opens New Game (decision U2). */}
            <button
              type="button"
              onClick={() => openModal('newGame')}
              aria-label="Colintaire — new game"
              className="rounded-md px-xs focus-visible:outline-2 focus-visible:outline-white"
            >
              <h1 className="text-title">Colintaire</h1>
            </button>
            <span className={`h-px bg-divider ${HEADER_LOGO ? 'w-3 min-[360px]:w-5 min-[400px]:w-6' : 'flex-1'}`} />
          </span>
          {HEADER_LOGO && <HeaderLogo />}
        </header>
        <div ref={boardRef} className="relative min-h-0 flex-1">
          {metrics && <Board metrics={metrics} />}
        </div>
        <div className="shrink-0" style={{ paddingTop: SHELL.statsGap }}>
          {metrics && <StatsPanel width={metrics.boardW} />}
        </div>
      </div>
      <AnimatePresence>
        {activeModal === 'newGame' && <NewGameModal key="newGame" />}
        {activeModal === 'appearance' && <AppearanceModal key="appearance" />}
        {activeModal === 'win' && <WinModal key="win" />}
        {activeModal === 'inspect' && <InspectView key="inspect" />}
        {activeModal === 'reshuffle' && <ReshuffleModal key="reshuffle" />}
      </AnimatePresence>
      <RotateOverlay />
    </div>
  );
}
