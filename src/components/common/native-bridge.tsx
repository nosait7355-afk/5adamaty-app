'use client';

import { useEffect, useRef } from 'react';
import { isRootPath, useSafeBack } from '@/lib/navigation-history';
import { closeTopOverlay } from '@/lib/overlay-stack';

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

      const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen'),
      ]);

      /*
       * الصفحة رُسمت وتفاعلية الآن (هذا المكوّن يُركَّب بعد الترطيب)، فتُخفى
       * شاشة البداية الأصلية — انتقال مباشر منها إلى الصفحة بلا شاشة بيضاء.
       * إعداد `launchShowDuration` في capacitor.config.ts يبقيها حتى هذه
       * اللحظة (نسخة المتجر 1.4+)؛ في النسخ الأقدم تكون قد اختفت أصلًا ولا يضر.
       */
      void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined);

      /*
       * شريط الحالة بلون الهيدر — كالتطبيقات الأصلية — ويتبع الوضع الليلي:
       * `Style.Light` = أيقونات داكنة لخلفية فاتحة، و`Style.Dark` العكس. على
       * أندرويد 15+ (targetSdk 36) الشريط يطفو فوق الصفحة إجباريًا ولا
       * يُلوَّن، فالمهم هناك لون الأيقونات وحده؛ لونه يظهر على الأقدم فقط.
       * الألوان = `--color-surface` في الوضعين (globals.css).
       */
      const root = document.documentElement;
      const applyStatusBar = () => {
        const dark = root.getAttribute('data-theme') === 'dark';
        void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
        void StatusBar.setBackgroundColor({ color: dark ? '#151b26' : '#ffffff' }).catch(
          () => undefined
        );
      };
      applyStatusBar();
      /*
       * يتبع المظهر المطبَّق فعلًا (`data-theme` — shared/theme.ts) لا إعداد
       * الهاتف وحده: اختيار «داكن» يدويًا من حسابي يقلب الشريط أيضًا، وكذلك
       * تغيير وضع الهاتف والتطبيق مفتوح على «تلقائي».
       */
      const themeObserver = new MutationObserver(applyStatusBar);
      themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

      // الشاشات الجذرية (الرئيسية وأخواتها) تُغلق التطبيق؛ غيرها يرجع للسابقة
      // أو — إن لم يوجد سجل — للرئيسية، بدل إغلاق التطبيق من صفحة داخلية.
      const backListener = await App.addListener('backButton', () => {
        // طبقة مفتوحة (Bottom Sheet)؟ الرجوع يغلقها فقط ويبقى في الصفحة
        if (closeTopOverlay()) return;
        if (isRootPath(window.location.pathname)) void App.exitApp();
        else safeBackRef.current();
      });

      cleanup = () => {
        void backListener.remove();
        themeObserver.disconnect();
      };
    })();

    return () => cleanup?.();
  }, []);

  return null;
}
