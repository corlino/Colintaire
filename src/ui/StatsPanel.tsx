import { ArrowsPointingOutIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { classicScore } from '../engine/selectors';
import { useGameStore } from '../store/gameStore';
import { vegasBalance } from '../store/session';
import { formatTime, formatVegas } from './format';

/** Font step for a value: 5 characters fit at full size in the narrowest (iPhone SE) panel. */
export function statValueClass(value: string): string {
  if (value.length <= 5) return 'text-stat-value';
  if (value.length === 6) return 'text-stat-value-md';
  return 'text-stat-value-sm';
}

function Stat({ label, icon: Icon, value }: { label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center rounded-sm bg-black px-sm min-[400px]:px-md" role="group" aria-label={`${label} ${value}`}>
      <span className="text-stat-label leading-tight">{label}</span>
      <span className="flex h-6 items-center gap-xs leading-tight">
        <Icon className="size-4.5 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden="true" />
        <span className={`${statValueClass(value)} truncate`}>{value}</span>
      </span>
    </div>
  );
}

/** Three equal black panels anchored at the bottom (Style Guide 6.4). Score keeps the $ icon in both modes. */
export function StatsPanel({ width, seconds }: { width: number; seconds: number }) {
  const session = useGameStore((s) => s.session);
  const { game } = session;
  const score = game.mode === 'vegas' ? formatVegas(vegasBalance(session)) : String(classicScore(game));
  return (
    <div className="mx-auto flex h-[68px] shrink-0 gap-md" style={{ width }}>
      <Stat label="Moves" icon={ArrowsPointingOutIcon} value={String(game.moves)} />
      <Stat label="Score" icon={CurrencyDollarIcon} value={score} />
      <Stat label="Time" icon={ClockIcon} value={formatTime(seconds)} />
    </div>
  );
}
