'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[ReliefSync SW] Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('[ReliefSync SW] Service Worker registration failed:', error);
        });
    }
  }, []);

  return null;
}
