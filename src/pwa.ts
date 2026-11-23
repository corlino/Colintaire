/**
 * Service worker registration and the quiet update flow (TAD §15.3).
 *
 * The worker precaches the whole app so it opens instantly and offline (U26).
 * Each time the app becomes visible it checks for a new version. A waiting
 * version is applied only at a safe moment — right after a new deal — with the
 * game saved first, so the reload lands on the same board. Otherwise it takes
 * over on the next cold launch.
 */
import { registerSW } from 'virtual:pwa-register';
import type { Autosave } from './store/autosave';
import { useGameStore } from './store/gameStore';

export function registerServiceWorker(autosave: Autosave) {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  let updateReady = false;
  const updateSW = registerSW({
    onNeedRefresh() {
      updateReady = true;
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
      });
    },
  });

  useGameStore.subscribe((s, prev) => {
    if (!updateReady || s.dealId === prev.dealId) return;
    autosave.flush();
    void updateSW(true);
  });
}
