'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * جسر Capacitor — لا يفعل شيئًا في المتصفح العادي.
 *
 * `Capacitor.isNativePlatform()` صحيح فقط داخل غلاف أندرويد؛ التطبيق نفسه
 * PWA/ويب أولًا (PROJECT_PLAN — Phase 10)، فهذا المكوّن تحسين شرطي لا مسار
 * تشغيل أساسي.
 *
 * زر الرجوع: يتنقّل ضمن سجل Next.js أولًا، ولا يُنهي التطبيق إلا حين لا
 * يبقى سجل تصفح — سلوك أندرويد المعتاد.
 *
 * الإشعارات: تسجيل الجهاز فقط. لا معالجة توكن هنا لأن الإشعارات العامة
 * تُبثّ عبر قناة داخل التطبيق (`admin/notifications`) — Push طبقة تنبيه
 * موازية اختيارية، وربطها بمزوّد فعلي (FCM) خطوة تشغيلية لاحقة منفصلة.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    void (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;

      const [{ App }, { StatusBar, Style }, { PushNotifications }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
        import('@capacitor/push-notifications'),
      ]);

      await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      await StatusBar.setBackgroundColor({ color: '#1156e0' }).catch(() => undefined);

      const backListener = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) router.back();
        else App.exitApp();
      });

      PushNotifications.requestPermissions()
        .then((result) => {
          if (result.receive === 'granted') return PushNotifications.register();
          return undefined;
        })
        .catch(() => undefined);

      cleanup = () => {
        void backListener.remove();
      };
    })();

    return () => cleanup?.();
  }, [router]);

  return null;
}
