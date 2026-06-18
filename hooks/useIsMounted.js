import { useEffect, useRef, useCallback } from 'react';

/**
 * Returns a stable () => boolean that reports whether the component is still
 * mounted. Use to guard setState calls after an await so user-triggered
 * one-shot async actions don't update state on an unmounted component.
 */
export function useIsMounted() {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  return useCallback(() => mountedRef.current, []);
}
