import { useState, useEffect, useCallback } from 'react';

export const useIdleTimer = (timeoutMs: number) => {
  const [isIdle, setIsIdle] = useState(false);

  const reset = useCallback(() => setIsIdle(false), []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const onActivity = () => {
      setIsIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIsIdle(true), timeoutMs);
    };

    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'] as const;
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    timer = setTimeout(() => setIsIdle(true), timeoutMs);

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, [timeoutMs]);

  return { isIdle, reset };
};
