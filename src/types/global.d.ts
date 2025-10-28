export {};

declare global {
  var ErrorUtils: {
    getGlobalHandler?: () => (error: any, isFatal?: boolean) => void;
    setGlobalHandler?: (handler: (error: any, isFatal?: boolean) => void) => void;
  };

  var __GLOBAL_HANDLER_SET__: boolean | undefined;
}
