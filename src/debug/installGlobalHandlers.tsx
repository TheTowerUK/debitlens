import React from 'react';

/**
 * installGlobalHandlers
 *
 * Sets up a global JS error handler and best-effort unhandled promise rejection logging
 * for React Native environments. Relies on the ambient declarations in src/types/global.d.ts
 * which should expose `ErrorUtils` and `__GLOBAL_HANDLER_SET__` on the global object.
 */

export function installGlobalHandlers(): void {
  // Catch *all* JS errors before RN turns them into a native fatal
  try {
    if (global.ErrorUtils && !global.__GLOBAL_HANDLER_SET__) {
      const prev = global.ErrorUtils.getGlobalHandler?.();

      global.ErrorUtils.setGlobalHandler?.((error: any, isFatal?: boolean) => {
        const msg = (error && (error.stack || error.message)) || String(error);
        // Log to Metro so we see the *real* cause
        console.log('[GlobalError]', isFatal ? '(FATAL)' : '', msg);
        if (prev) {
          try {
            prev(error, isFatal);
          } catch {}
        }
      });

      global.__GLOBAL_HANDLER_SET__ = true;
    }
  } catch {}

  // Best-effort unhandled promise rejection logging (RN environment varies)
  try {
    if (typeof global.onunhandledrejection === 'undefined') {
      global.onunhandledrejection = (event: any) => {
        const err = event?.reason || event;
        const msg = (err && (err.stack || err.message)) || String(err);
        console.log('[UnhandledPromiseRejection]', msg);
      };
    }
  } catch {}
}
