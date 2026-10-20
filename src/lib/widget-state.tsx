import { createContext, useContext, useEffect, useState } from 'react';

export type WidgetStateStore = Map<string, unknown>;
export const WidgetStateContext = createContext<{ messageId: string; store: WidgetStateStore } | null>(null);

/** Local controls belong to a message, not to a globally reused widget id. */
export function useWidgetState<T>(widgetId: string, initial: T) {
  const scope = useContext(WidgetStateContext);
  const key = `${scope?.messageId ?? ''}:${widgetId}`;
  const [state, setState] = useState<T>(() => scope?.store.has(key) ? scope.store.get(key) as T : initial);
  useEffect(() => { scope?.store.set(key, state); }, [scope, key, state]);
  return [state, setState] as const;
}
