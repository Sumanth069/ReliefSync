'use client';

import { useState, useEffect, useCallback } from 'react';

export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'LIE_FI';

export function useConnectivity() {
  const [status, setStatus] = useState<ConnectivityStatus>('ONLINE');
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const checkConnection = useCallback(async (): Promise<ConnectivityStatus> => {
    if (isSimulatedOffline) {
      setStatus('OFFLINE');
      setLatencyMs(null);
      return 'OFFLINE';
    }

    if (typeof window === 'undefined') return 'ONLINE';

    if (!navigator.onLine) {
      setStatus('OFFLINE');
      setLatencyMs(null);
      return 'OFFLINE';
    }

    // Active probe to check for "Lie-Fi"
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const start = performance.now();

    try {
      const res = await fetch('/api/ping', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const elapsed = Math.round(performance.now() - start);
        setLatencyMs(elapsed);
        setStatus('ONLINE');
        return 'ONLINE';
      } else {
        setStatus('LIE_FI');
        setLatencyMs(null);
        return 'LIE_FI';
      }
    } catch {
      clearTimeout(timeoutId);
      // Browser reports online, but ping timed out or failed -> Lie-Fi detected!
      setStatus('LIE_FI');
      setLatencyMs(null);
      return 'LIE_FI';
    }
  }, [isSimulatedOffline]);

  useEffect(() => {
    // Initial probe
    checkConnection();

    const handleOnline = () => checkConnection();
    const handleOffline = () => {
      setStatus('OFFLINE');
      setLatencyMs(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic heartbeat probe every 10 seconds
    const interval = setInterval(checkConnection, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection]);

  const toggleSimulateOffline = () => {
    setIsSimulatedOffline((prev) => {
      const next = !prev;
      if (next) {
        setStatus('OFFLINE');
      } else {
        setTimeout(checkConnection, 100);
      }
      return next;
    });
  };

  return {
    status,
    isOnline: status === 'ONLINE',
    isOffline: status === 'OFFLINE',
    isLieFi: status === 'LIE_FI',
    latencyMs,
    isSimulatedOffline,
    toggleSimulateOffline,
    checkConnection,
  };
}
