import React from 'react';

/**
 * installGlobalHandlers
 *
 * Sets up a global JS error handler and best-effort unhandled promise rejection logging
 * for React Native environments. Relies on the ambient declarations in src/types/global.d.ts
 * which should expose `ErrorUtils` and `__GLOBAL_HANDLER_SET__` on the global object.
 */

type ErrorUtilsShape = {
  getGlobalHandler?: () => ((error: any, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: any, isFatal?: boolean) => void) => void;
};

type GlobalWithErrorUtils = {
  ErrorUtils?: ErrorUtilsShape;
  __GLOBAL_HANDLER_SET__?: boolean;
  onunhandledrejection?: ((event: any) => void) | undefined;
} & typeof globalThis;

export function installGlobalHandlers(): void {
  const g = global as unknown as GlobalWithErrorUtils;

  try {
    if (g.ErrorUtils && !g.__GLOBAL_HANDLER_SET__) {
      const prev = g.ErrorUtils.getGlobalHandler?.();

      g.ErrorUtils.setGlobalHandler?.((error: any, isFatal?: boolean) => {
        const msg = (error && (error.stack || error.message)) || String(error);
        console.log('[GlobalError]', isFatal ? '(FATAL)' : '', msg);
        if (prev) {
          try {
            prev(error, isFatal);
          } catch {}
        }
      });

      g.__GLOBAL_HANDLER_SET__ = true;
    }
  } catch {}

  try {
    if (typeof g.onunhandledrejection === 'undefined') {
      g.onunhandledrejection = (event: any) => {
        const err = event?.reason || event;
        const msg = (err && (err.stack || err.message)) || String(err);
        console.log('[UnhandledPromiseRejection]', msg);
      };
    }
  } catch {}
}

