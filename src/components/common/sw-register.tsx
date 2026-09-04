'use client';

import { useEffect } from 'react';

/** يسجّل service worker غلاف PWA بعد اكتمال التحميل (لا يعطّل التفاعل الأول). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // فشل تسجيل الـSW لا يكسر التطبيق — PWA تحسين إضافي لا شرط تشغيل.
      });
    };

    // `load` قد يكون وقع فعلًا قبل تركيب هذا المكوّن (يُرطَّب بعده عادة).
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
