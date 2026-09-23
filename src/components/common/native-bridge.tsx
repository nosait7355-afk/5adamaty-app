'use client';

import { useEffect, useRef } from 'react';
import { isRootPath, useSafeBack } from '@/lib/navigation-history';

/**
 * جسر Capacitor — لا يفعل شيئًا في المتصفح العادي.
 *
 * `Capacitor.isNativePlatform()` صحيح فقط داخل غلاف أندرويد؛ التطبيق نفسه
 * PWA/ويب أولًا (PROJECT_PLAN — Phase 10)، فهذا المكوّن تحسين شرطي لا مسار
 * تشغيل أساسي.
 *
 * زر الرجوع: نفس منطق زر الرجوع في الواجهة (`useSafeBack`)، ولا يُنهي
 * التطبيق إلا من شاشة جذرية كالرئيسية — سلوك أندرويد المعتاد.
 *
 * إشعارات Push **معطّلة عمدًا**: `PushNotifications.register()` يتطلب Firebase
 * (`android/app/google-services.json`)، وهو غير مُعدّ. استدعاؤه بدونه يُسقط
 * التطبيق فور موافقة المستخدم على الإذن. الإشعارات تصل عبر القناة الداخلية
 * (`/notifications`)؛ تفعيل Push يبدأ بإضافة ملف Firebase ثم إعادة الاستدعاء.
 */
export function NativeBridge() {
  const safeBack = useSafeBack();
  const safeBackRef = useRef(safeBack);

  useEffect(() => {
    safeBackRef.current = safeBack;
  }, [safeBack]);

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

      // الشاشات الجذرية (الرئيسية وأخواتها) تُغلق التطبيق؛ غيرها يرجع للسابقة
      // أو — إن لم يوجد سجل — للرئيسية، بدل إغلاق التطبيق من صفحة داخلية.
      const backListener = await App.addListener('backButton', () => {
        if (isRootPath(window.location.pathname)) void App.exitApp();
        else safeBackRef.current();
      });

      cleanup = () => {
        void backListener.remove();
      };
    })();

    return () => cleanup?.();
  }, []);

  return null;
}
