import { useEffect, useRef } from 'react';

export function useIntegrityMonitoring(
  attemptId: string,
  silentLog: (logType: string, details: Record<string, any>) => void
) {
  const blurTimeRef = useRef<number | null>(null);

  // INTEG-01: Tab switch with blur duration calculation
  useEffect(() => {
    const handleBlur = () => {
      blurTimeRef.current = Date.now();
    };

    const handleFocus = () => {
      if (blurTimeRef.current !== null) {
        const durationMs = Date.now() - blurTimeRef.current;
        blurTimeRef.current = null;
        silentLog('tab_switch', {
          durationMs,
          description: `Candidate switched tab / window blurred for ${Math.round(durationMs / 1000)} seconds`
        });
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [silentLog]);

  // INTEG-02: Copy-paste attempts logged silently
  useEffect(() => {
    const handleCopyPaste = (e: Event) => {
      silentLog('copy_paste', {
        eventType: e.type,
        description: `Candidate attempted to ${e.type} content`
      });
    };

    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);

    return () => {
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
    };
  }, [silentLog]);

  // INTEG-03: Dev-tools-open heuristic detection
  useEffect(() => {
    const threshold = 160;
    const checkDevTools = () => {
      const isDevToolsOpen =
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold;
      if (isDevToolsOpen) {
        silentLog('devtools_check', {
          description: 'Developer tools opening detected'
        });
      }
    };

    window.addEventListener('resize', checkDevTools);
    const interval = setInterval(checkDevTools, 4000);

    return () => {
      window.removeEventListener('resize', checkDevTools);
      clearInterval(interval);
    };
  }, [silentLog]);

  // INTEG-04: Fullscreen-exit events logged silently
  useEffect(() => {
    const handleFullscreenExit = () => {
      if (!document.fullscreenElement) {
        silentLog('fullscreen_exit', {
          description: 'Candidate exited fullscreen mode'
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenExit);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenExit);
    };
  }, [silentLog]);
}
