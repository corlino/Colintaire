import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULTS, pick, THEMES } from '../assets/registry';
import { computeMetrics } from '../layout';
import { useGameStore } from '../store/gameStore';
import { Board } from './Board';
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
  }, [themeId]);
}

export function App() {
  useThemeBackground();
  const [boardRef, area] = useSize<HTMLDivElement>();
  const metrics = useMemo(() => (area.width > 0 ? computeMetrics(area.width, area.height) : null), [area.width, area.height]);

  return (
    <div className="app-shell flex h-full flex-col">
      <div className="mx-auto flex h-full w-full max-w-[520px] min-h-0 flex-col px-lg min-[400px]:px-[20px]">
        <header className="flex shrink-0 items-center gap-lg" style={{ height: SHELL.header }}>
          <span className="h-px flex-1 bg-divider" />
          <h1 className="text-title">Solitaire</h1>
          <span className="h-px flex-1 bg-divider" />
        </header>
        <div ref={boardRef} className="relative min-h-0 flex-1">
          {metrics && <Board metrics={metrics} />}
        </div>
        <div className="shrink-0" style={{ paddingTop: SHELL.statsGap }}>
          {metrics && <StatsPanel width={metrics.boardW} seconds={0} />}
        </div>
      </div>
    </div>
  );
}
