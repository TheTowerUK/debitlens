export {};

declare global {
  // React Native ErrorUtils (partial)
  var ErrorUtils: {
    getGlobalHandler?: () => (error: any, isFatal?: boolean) => void;
    setGlobalHandler?: (handler: (error: any, isFatal?: boolean) => void) => void;
  } | undefined;

  var __GLOBAL_HANDLER_SET__: boolean | undefined;
}
