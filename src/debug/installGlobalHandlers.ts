export function installGlobalHandlers(): void {
  // Catch *all* JS errors before RN turns them into a native fatal
  try {
    if (global.ErrorUtils && !global.__GLOBAL_HANDLER_SET__) {
      const prev =
        global.ErrorUtils.getGlobalHandler?.();

      global.ErrorUtils.setGlobalHandler?.((error, isFatal) => {
        const msg =
          (error && (error.stack || error.message)) || String(error);
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

  // Best-effort unhandled promise rejection logging
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


