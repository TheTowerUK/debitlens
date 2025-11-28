// src/notifications/bootstrapper.ts

/**
 * Notification bootstrapper
 *
 * For now this is a no-op: we don't yet have a prefs/settings slice
 * on the global app state, so we avoid reading state.prefs entirely.
 *
 * When you're ready to add notification preferences, you can expand
 * this to listen to store changes and register/cancel notifications.
 */
export function attachNotificationBootstrap(
  _store: {
    getState: () => unknown;
    subscribe: (listener: () => void) => void;
  }
): void {
  // No-op for now – notifications prefs not wired into global state yet.
  // Example of what could go here later:
  //
  // let lastState = _store.getState();
  //
  // _store.subscribe(() => {
  //   const state = _store.getState();
  //   // compare state with lastState and adjust notifications
  //   // (e.g. schedule/cancel push notifications)
  //   lastState = state;
  // });
}

// Support both named and default import styles:
//   import { attachNotificationBootstrap } from '...'
//   import attachNotificationBootstrap from '...'
export default attachNotificationBootstrap;
