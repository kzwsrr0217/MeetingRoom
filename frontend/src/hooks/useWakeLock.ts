import { useEffect } from 'react';

export const useWakeLock = () => {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Wake Lock not supported or permission denied — silent fail
      }
    };

    acquire();

    // Re-acquire when the tab becomes visible again (lock releases on hide)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      lock?.release();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
};
