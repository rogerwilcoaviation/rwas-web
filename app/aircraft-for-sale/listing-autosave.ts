'use client';
import { useEffect, useRef, useState } from 'react';
export type RecoveryDraft = {
  values: Record<string, string>;
  step: number;
  listingId: string | null;
  listingRevision: number | null;
  expectedRevision: string | null;
  updatedAt: number;
};
export const recoveryKey = (owner: string) =>
  'rwas-listing-recovery-v1:' + owner.trim().toLowerCase();
export function readRecovery(owner: string): RecoveryDraft | null {
  try {
    const draft = JSON.parse(
      localStorage.getItem(recoveryKey(owner)) || 'null',
    );
    if (
      !draft ||
      !draft.values ||
      !Number.isInteger(draft.step) ||
      !Number.isFinite(draft.updatedAt) ||
      Object.values(draft.values).some((value) => typeof value !== 'string')
    )
      return null;
    return draft;
  } catch {
    return null;
  }
}
export function isAutosaveNetworkError(error: unknown) {
  return error instanceof TypeError && !(error as { status?: number }).status;
}
export function savedDraftMatches(
  saved: unknown,
  pending: RecoveryDraft,
): boolean {
  if (!saved || typeof saved !== 'object') return false;
  const draft = saved as Partial<RecoveryDraft>;
  if (
    draft.step !== pending.step ||
    draft.listingId !== pending.listingId ||
    draft.listingRevision !== pending.listingRevision ||
    !draft.values ||
    typeof draft.values !== 'object'
  )
    return false;
  const savedEntries = Object.entries(draft.values);
  const pendingEntries = Object.entries(pending.values);
  return (
    savedEntries.length === pendingEntries.length &&
    pendingEntries.every(([key, value]) => draft.values?.[key] === value)
  );
}
type Config = {
  owner: string;
  enabled: boolean;
  editor: number;
  values: Record<string, string>;
  step: number;
  listingId: string | null;
  listingRevision: number | null;
  revision: { current: string | null };
  request: (body: RecoveryDraft) => Promise<{ revision: string }>;
};
export function useListingAutosave(config: Config) {
  const current = useRef(config);
  current.current = config;
  const queue = useRef(Promise.resolve());
  const last = useRef('');
  const activeEditor = useRef(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notice, setNotice] = useState('');
  const [issue, setIssue] = useState(false);
  const signature = (values: Record<string, string>, step: number) =>
    JSON.stringify({ values, step });
  function capture(
    values = current.current.values,
    step = current.current.step,
  ) {
    const c = current.current;
    const draft = {
      values,
      step,
      listingId: c.listingId,
      listingRevision: c.listingRevision,
      expectedRevision: c.revision.current,
      updatedAt: Date.now(),
    };
    if (c.owner && c.enabled) {
      try {
        localStorage.setItem(recoveryKey(c.owner), JSON.stringify(draft));
      } catch {
        setIssue(true);
        setNotice(
          'This browser could not keep a recovery copy. Keep this page open until your draft is saved online.',
        );
      }
    }
    return draft;
  }
  function flush() {
    if (timer.current) clearTimeout(timer.current);
    const c = current.current,
      editor = c.editor;
    if (!c.enabled) return queue.current;
    const sig = signature(c.values, c.step);
    if (sig === last.current) return queue.current;
    const draft = capture();
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        if (
          editor !== current.current.editor ||
          c.owner !== current.current.owner ||
          sig === last.current
        )
          return;
        setNotice('Saving draft…');
        setIssue(false);
        try {
          const result = await c.request({
            ...draft,
            expectedRevision: c.revision.current,
          });
          if (
            editor !== current.current.editor ||
            c.owner !== current.current.owner
          )
            return;
          c.revision.current = result.revision;
          last.current = sig;
          if (signature(current.current.values, current.current.step) === sig) {
            capture();
            setNotice('All changes saved online.');
            setIssue(false);
          } else setNotice('Saving your latest changes…');
        } catch (error) {
          if (editor !== current.current.editor) return;
          setIssue(true);
          setNotice(
            error instanceof Error
              ? error.message + ' Your recovery copy is kept on this device.'
              : 'Could not save online. Your recovery copy is kept on this device.',
          );
          throw error;
        }
      });
    queue.current = task;
    return task;
  }
  function markSaved() {
    if (timer.current) clearTimeout(timer.current);
    last.current = signature(current.current.values, current.current.step);
    try {
      localStorage.removeItem(recoveryKey(current.current.owner));
    } catch {}
    setNotice('All changes saved online.');
    setIssue(false);
  }
  useEffect(() => {
    if (!config.enabled) return;
    if (activeEditor.current !== config.editor) {
      activeEditor.current = config.editor;
      const recovered = readRecovery(config.owner);
      last.current =
        recovered &&
        JSON.stringify(recovered.values) === JSON.stringify(config.values) &&
        recovered.step === config.step
          ? ''
          : signature(config.values, config.step);
      setNotice('Changes save automatically as you type.');
      setIssue(false);
      if (last.current) return;
    }
    if (signature(config.values, config.step) === last.current) return;
    capture();
    setNotice('Changes saved on this device. Syncing…');
    timer.current = setTimeout(() => void flush().catch(() => {}), 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // All operations read current.current; function identities must not restart syncing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, config.editor, config.values, config.step]);
  useEffect(() => {
    if (!config.enabled) return;
    const persist = () => {
      if (
        signature(current.current.values, current.current.step) === last.current
      )
        return;
      capture();
      void flush().catch(() => {});
    };
    const hide = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('pagehide', persist);
    window.addEventListener('online', persist);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', persist);
      window.removeEventListener('online', persist);
      document.removeEventListener('visibilitychange', hide);
    };
    // Lifecycle handlers intentionally use the current configuration ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, config.editor]);
  return { capture, flush, markSaved, notice, issue };
}
