import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

/** A phone held sideways: short viewport and a touch screen (TAD §9.6, U21). Desktop windows never match. */
export const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 499px) and (pointer: coarse)';

function usePhoneLandscape() {
  const [match, setMatch] = useState(() => typeof matchMedia === 'function' && matchMedia(PHONE_LANDSCAPE_QUERY).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(PHONE_LANDSCAPE_QUERY);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return match;
}

/** Covers the game in phone landscape and pauses the timer until the phone is upright again. */
export function RotateOverlay() {
  const landscape = usePhoneLandscape();
  const setPaused = useGameStore((s) => s.setPaused);
  useEffect(() => {
    setPaused('rotate', landscape);
  }, [landscape, setPaused]);
  if (!landscape) return null;
  return (
    <div
      role="alert"
      data-testid="rotate-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-lg bg-background text-center"
    >
      <DevicePhoneMobileIcon className="size-12 text-accent" aria-hidden />
      <p className="text-instruction">Rotate your phone</p>
      <p className="text-stat-label">Colintaire plays in portrait.</p>
    </div>
  );
}
