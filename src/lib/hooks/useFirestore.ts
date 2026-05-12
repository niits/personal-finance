"use client";

import { useEffect, useState } from "react";
import {
  onSnapshot,
  type Query,
  type DocumentReference,
  type DocumentData,
} from "firebase/firestore";

export type Loadable<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
};

// React's "set-state-in-effect" lint rule discourages synchronous state updates
// inside effects. Subscriptions to an external system (Firestore) are the
// canonical exception called out in the rule's own docs — initial loading flag
// flips and reset-on-input-change are unavoidable. Disable the rule per-line.

export function useCollection<T extends DocumentData>(
  q: Query<T> | null,
  deps: ReadonlyArray<unknown>,
): Loadable<Array<T & { id: string }>> {
  const [state, setState] = useState<Loadable<Array<T & { id: string }>>>({
    data: undefined,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: undefined, loading: false, error: null });
      return;
    }
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
        setState({ data: docs, loading: false, error: null });
      },
      (err) => setState({ data: undefined, loading: false, error: err }),
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export function useDocument<T extends DocumentData>(
  ref: DocumentReference<T> | null,
  deps: ReadonlyArray<unknown>,
): Loadable<(T & { id: string }) | null> {
  const [state, setState] = useState<Loadable<(T & { id: string }) | null>>({
    data: undefined,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!ref) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: undefined, loading: false, error: null });
      return;
    }
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null;
        setState({ data, loading: false, error: null });
      },
      (err) => setState({ data: undefined, loading: false, error: err }),
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
