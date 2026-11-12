import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

function getCharacter() {
  const match = window.location.hash.match(/^#\/dictionary\/([^/]+)$/);
  try {
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

// Hash URLs work in a normal browser and a future local desktop host, and
// support direct links, refresh, and browser Back without server rewrites.
export function useDictionaryRoute() {
  return useSyncExternalStore(subscribe, getCharacter, () => null);
}
