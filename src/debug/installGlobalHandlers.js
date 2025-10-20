// src/debug/installGlobalHandlers.js
export function installGlobalHandlers() {
  // Global JS errors
  if (global.ErrorUtils && !global.__GLOBAL_HANDLER_SET__) {
    const prev = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      try {
        console.log('[GlobalError]', isFatal ? '(FATAL)' : '', String(error && error.stack || error));
      } catch {}
      if (prev) try { prev(error, isFatal); } catch {}
    });
    global.__GLOBAL_HANDLER_SET__ = true;
  }

  // Unhandled promise rejections
  if (!global.__PROMISE_REJECTION_SET__) {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id, error) => {
        console.log('[UnhandledPromiseRejection]', id, String(error && error.stack || error));
      },
      onHandled: (id) => {
        console.log('[RejectionHandled]', id);
      }
    });
    global.__PROMISE_REJECTION_SET__ = true;
  }
}
