import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api-client';
import { useMe } from '@/lib/queries/auth';

/**
 * إشعارات Push — تُفعَّل فقط حين يُبنى التطبيق ومعه
 * `android/app/google-services.json` (`__PUSH_ENABLED__` في vite.config.ts):
 * `PushNotifications.register()` بلا Firebase يُسقط التطبيق فور منح الإذن.
 *
 * الإذن يُطلب بعد تسجيل الدخول لا عند أول فتح — المستخدم يعرف حينها لماذا.
 * رفضه لا يغيّر شيئًا: الإشعارات تبقى في شاشة الإشعارات داخل التطبيق.
 */

const TOKEN_KEY = 'khadamat_push_token';

/** رمز هذا الجهاز إن سُجّل — يحتاجه تسجيل الخروج ليلغيه من الخادم. */
export function storedPushToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function forgetPushToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // لا شيء
  }
}

export function PushRegistration() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const userId = user?.id;

  useEffect(() => {
    if (!__PUSH_ENABLED__ || !userId) return;
    let disposed = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    void (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { PushNotifications } = await import('@capacitor/push-notifications');

      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === 'prompt') permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted' || disposed) return;

      handles.push(
        await PushNotifications.addListener('registration', ({ value }) => {
          try {
            localStorage.setItem(TOKEN_KEY, value);
          } catch {
            // بلا تخزين: لن يُلغى الرمز عند الخروج، وتحذفه مدة الصلاحية (90 يومًا)
          }
          void api.post('/me/devices', { token: value }).catch(() => undefined);
        }),
        // نقر الإشعار: يفتح الشاشة المعنية — مسار داخلي فقط
        await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const actionUrl: unknown = notification.data?.actionUrl;
          void navigate(typeof actionUrl === 'string' && actionUrl.startsWith('/') ? actionUrl : '/notifications');
        })
      );
      await PushNotifications.register();
    })();

    return () => {
      disposed = true;
      for (const handle of handles) void handle.remove();
    };
  }, [userId, navigate]);

  return null;
}
