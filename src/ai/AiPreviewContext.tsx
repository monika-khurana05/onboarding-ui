import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useEffect, useState } from 'react';

type AiPreviewContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
};

const STORAGE_KEY = 'ai_preview_enabled';

const AiPreviewContext = createContext<AiPreviewContextValue | undefined>(undefined);

function readInitialValue(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return false;
    }
    return raw === 'true';
  } catch {
    return false;
  }
}

export function AiPreviewProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabled] = useState<boolean>(() => readInitialValue());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Ignore persistence errors.
    }
  }, [enabled]);

  const value = useMemo<AiPreviewContextValue>(
    () => ({
      enabled,
      setEnabled,
      toggle: () => setEnabled((prev) => !prev)
    }),
    [enabled]
  );

  return <AiPreviewContext.Provider value={value}>{children}</AiPreviewContext.Provider>;
}

export function useAiPreview() {
  const context = useContext(AiPreviewContext);
  if (!context) {
    throw new Error('useAiPreview must be used within an AiPreviewProvider.');
  }
  return context;
}
