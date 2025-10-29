export {};

declare global {
  // Partial React Native ErrorUtils contract
  var ErrorUtils: {
    getGlobalHandler?: () => (error: any, isFatal?: boolean) => void;
    setGlobalHandler?: (handler: (error: any, isFatal?: boolean) => void) => void;
  } | undefined;

  var __GLOBAL_HANDLER_SET__: boolean | undefined;

  interface GlobalEventHandlers {
    onunhandledrejection?: ((event: any) => void) | undefined;
  }
}
