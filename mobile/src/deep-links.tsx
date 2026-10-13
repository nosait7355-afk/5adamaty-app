import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { API_ORIGIN } from './config';

/**
 * رابط من الموقع فُتح بالتطبيق (واتساب، بريد إعادة تعيين كلمة المرور،
 * مشاركة ملف مقدم خدمة) — يفتح الشاشة نفسها داخل التطبيق.
 *
 * أندرويد يسلّم التطبيق روابط النطاق المسجّل فقط (`intent-filter`)، لكن
 * نتحقق من النطاق هنا أيضًا: لا نتنقّل أبدًا لرابط لا نعرفه.
 *
 * حالتان: التطبيق مفتوح (`appUrlOpen`)، أو فُتح أصلًا بالرابط (`getLaunchUrl`).
 */
export function routeFromLink(url: string): string | null {
  try {
    const link = new URL(url);
    if (link.origin !== new URL(API_ORIGIN).origin) return null;
    return `${link.pathname}${link.search}`;
  } catch {
    return null;
  }
}

export function DeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    let disposed = false;
    let remove: (() => void) | undefined;

    void (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import('@capacitor/app');

      const open = (url: string) => {
        const route = routeFromLink(url);
        if (route) void navigate(route);
      };

      const launch = await App.getLaunchUrl();
      if (launch?.url && !disposed) open(launch.url);

      const handle = await App.addListener('appUrlOpen', (event) => open(event.url));
      if (disposed) void handle.remove();
      else remove = () => void handle.remove();
    })();

    return () => {
      disposed = true;
      remove?.();
    };
  }, [navigate]);

  return null;
}
