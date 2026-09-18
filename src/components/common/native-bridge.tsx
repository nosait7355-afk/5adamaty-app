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
 * إشعارات Push **معطّلة عمدًا**: `PushNotifications.register()` يتطلب Firebase
 * (`android/app/google-services.json`)، وهو غير مُعدّ. استدعاؤه بدونه يُسقط
 * التطبيق فور موافقة المستخدم على الإذن. الإشعارات تصل عبر القناة الداخلية
 * (`/notifications`)؛ تفعيل Push يبدأ بإضافة ملف Firebase ثم إعادة الاستدعاء.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    void (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;

      const [{ App }, { StatusBar, Style }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
      ]);

      await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      await StatusBar.setBackgroundColor({ color: '#1156e0' }).catch(() => undefined);

      const backListener = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) router.back();
        else App.exitApp();
      });

      cleanup = () => {
        void backListener.remove();
      };
    })();

    return () => cleanup?.();
  }, [router]);

  return null;
}
