export {};

declare global {
  // Partial ErrorUtils contract used by React Native / Expo apps
  interface ErrorUtils {
    getGlobalHandler?: () => ((error: any, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (handler: (error: any, isFatal?: boolean) => void) => void;
  }

  var ErrorUtils: ErrorUtils | undefined;

  // guard used by your installGlobalHandlers implementation
  var __GLOBAL_HANDLER_SET__: boolean | undefined;

  // optional: runtime handler for unhandled promise rejections
  var onunhandledrejection: ((event: any) => void) | undefined;
}
