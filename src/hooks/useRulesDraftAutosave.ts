import { useEffect, useRef } from 'react';
import { saveRulesDraft, type RulesDraft } from '../lib/storage/rulesDraftStorage';

type UseRulesDraftAutosaveArgs = {
  enabled: boolean;
  countryCode: string;
  buildDraft: () => RulesDraft | null;
  debounceMs?: number;
  onSaved?: (draft: RulesDraft) => void;
};

export function useRulesDraftAutosave({
  enabled,
  countryCode,
  buildDraft,
  debounceMs = 500,
  onSaved
}: UseRulesDraftAutosaveArgs) {
  const buildDraftRef = useRef(buildDraft);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    buildDraftRef.current = buildDraft;
  }, [buildDraft]);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    if (!enabled || !countryCode.trim()) {
      return;
    }

    const timer = window.setTimeout(() => {
      const draft = buildDraftRef.current();
      if (!draft) {
        return;
      }
      saveRulesDraft(draft);
      onSavedRef.current?.(draft);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [enabled, countryCode, debounceMs, buildDraft]);

  useEffect(() => {
    if (!enabled || !countryCode.trim()) {
      return;
    }

    const handleBeforeUnload = () => {
      const draft = buildDraftRef.current();
      if (!draft) {
        return;
      }
      saveRulesDraft(draft);
      onSavedRef.current?.(draft);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, countryCode]);
}
