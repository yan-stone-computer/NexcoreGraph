import { store } from './Store';

const KNOWN_TARGETS: string[] = ['ai', 'libs', 'alerts', 'intake', 'plans', 'shopping'];

/** Validate a card or notification deep-link target before persisting it. */
export function parseEntryTarget(value: Object | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }
  return KNOWN_TARGETS.indexOf(value) >= 0 ? value : '';
}

/**
 * Apply the queued target only after authentication.
 * Returns true when a target was consumed.
 */
export function applyPendingEntryTarget(): boolean {
  if (!store.loggedIn || store.pendingEntryTarget === '') {
    return false;
  }
  const target: string = store.pendingEntryTarget;
  store.pendingEntryTarget = '';
  if (target === 'ai') {
    store.aiOpen = true;
  } else if (target === 'libs') {
    store.tabIndex = 1;
  } else if (target === 'alerts') {
    store.overlay = 'alerts';
  } else if (target === 'intake' || target === 'plans' || target === 'shopping') {
    store.overlay = target;
  } else {
    return false;
  }
  return true;
}
