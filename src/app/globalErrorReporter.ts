type GlobalErrorHandler = (message: string) => void;

let globalErrorHandler: GlobalErrorHandler | null = null;

export function setGlobalErrorHandler(handler: GlobalErrorHandler | null) {
  globalErrorHandler = handler;
}

export function reportGlobalError(message: string) {
  if (globalErrorHandler) {
    globalErrorHandler(message);
  }
}
