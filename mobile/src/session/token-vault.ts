import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { NativeSession } from '@/server/lib/session-transport';

/**
 * مكان توكنات الجلسة على الجهاز.
 *
 * - توكن التحديث (30 يومًا): في التخزين الآمن — على أندرويد مشفّر بـAES-GCM
 *   بمفتاح من Android Keystore، ويُحذف مع حذف التطبيق. (هذا ما تَعِد به
 *   سياسة الخصوصية — `src/app/privacy/page.tsx`.)
 * - توكن الوصول (15 دقيقة): في الذاكرة فقط. يضيع بإغلاق التطبيق، وأول طلب
 *   بعد الفتح يجدّده تلقائيًا (401 ← `/auth/refresh` ← إعادة الطلب).
 *
 * ⚠️ في متصفح التطوير (`npm run mobile:dev`) تحفظ الإضافة في localStorage
 * بلا تشفير — للتطوير فقط، الحزمة المنشورة تعمل داخل أندرويد دائمًا.
 */

const REFRESH_KEY = 'session.refresh';
/** نجدّد قبل الانتهاء بهامش، بدل أن يفشل طلب في منتصف الطريق. */
const EXPIRY_MARGIN_MS = 30_000;

let access: { token: string; expiresAt: number } | null = null;

void SecureStorage.setKeyPrefix('khadamat_').catch(() => undefined);

export function getAccessToken(): string | null {
  if (!access || access.expiresAt - EXPIRY_MARGIN_MS <= Date.now()) return null;
  return access.token;
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    const value = await SecureStorage.get(REFRESH_KEY);
    return typeof value === 'string' && value ? value : null;
  } catch {
    // بيانات تالفة أو مفتاح Keystore أُبطل (تغيير قفل الشاشة) — جلسة منتهية
    return null;
  }
}

export async function saveSession(session: NativeSession): Promise<void> {
  access = {
    token: session.accessToken,
    expiresAt: Date.now() + session.accessTokenExpiresIn * 1000,
  };
  await SecureStorage.set(REFRESH_KEY, session.refreshToken);
}

export async function clearSession(): Promise<void> {
  access = null;
  await SecureStorage.remove(REFRESH_KEY).catch(() => false);
}
