import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './ui/App';
import { startAutosave } from './store/autosave';
import { installDevHook } from './store/devHook';
import { useGameStore } from './store/gameStore';
import { loadAll, requestPersistentStorage } from './store/persistence';
import { registerServiceWorker } from './pwa';

// Restore before the first render so the board opens on the saved game (TAD §14).
useGameStore.getState().restore(loadAll());
const autosave = startAutosave();
requestPersistentStorage();
registerServiceWorker(autosave);

if (import.meta.env.DEV) installDevHook();

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
