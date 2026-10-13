import { z } from 'zod';
import { NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE } from '@/shared/constants/native-app';
import { ACCESS_TOKEN_TTL_SECONDS } from './jwt';
import { REFRESH_COOKIE, clearSessionCookies, readTokenFromRequest, setSessionCookies } from './cookies';

/**
 * طريقة تسليم الجلسة حسب العميل.
 *
 * الموقع (والغلاف القديم): كوكيز httpOnly كما هي — لا تغيير.
 * تطبيق «خدمات الفيوم»: واجهته على `https://localhost` لا على نطاق الـAPI،
 * فلا تصله كوكيز الطرف الأول. يستلم التوكنين في جسم الرد ويحفظهما في
 * التخزين المشفّر على الجهاز (Android Keystore)، ويرسل توكن الوصول في
 * `Authorization: Bearer`.
 *
 * القاعدة: الوضعان لا يختلطان. وضع التطبيق لا يقرأ الكوكيز ولا يكتبها،
 * فطلب برأس التطبيق من متصفح فيه جلسة لا يكشف توكناتها.
 */

export interface NativeSession {
  accessToken: string;
  refreshToken: string;
  /** بالثواني — يجدّد التطبيق قبل الانتهاء بدل انتظار 401. */
  accessTokenExpiresIn: number;
}

export function isNativeClient(request: Request): boolean {
  return request.headers.get(NATIVE_CLIENT_HEADER) === NATIVE_CLIENT_VALUE;
}

/**
 * يسلّم جلسة صادرة للتو: كوكيز للموقع، أو كائن `session` يُضاف لجسم الرد
 * للتطبيق. يعيد `null` في حالة الكوكيز.
 */
export async function deliverSession(
  request: Request,
  tokens: { accessToken: string; refreshToken: string },
  options: { remember: boolean }
): Promise<NativeSession | null> {
  if (isNativeClient(request)) {
    return { ...tokens, accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }
  await setSessionCookies({ ...tokens, remember: options.remember });
  return null;
}

/** يضيف `session` لبيانات الرد حين وُجدت (التطبيق فقط). */
export function withSession<T extends object>(data: T, session: NativeSession | null) {
  return session ? { ...data, session } : data;
}

const refreshBodySchema = z.object({ refreshToken: z.string().min(1).max(4096) });

/**
 * توكن التحديث المقدَّم: من الجسم `{ refreshToken }` للتطبيق، ومن الكوكي
 * للموقع — أبدًا لا من الآخر.
 */
export async function readPresentedRefreshToken(request: Request): Promise<string | null> {
  if (!isNativeClient(request)) return readTokenFromRequest(request, REFRESH_COOKIE);

  const body: unknown = await request.json().catch(() => null);
  const parsed = refreshBodySchema.safeParse(body);
  return parsed.success ? parsed.data.refreshToken : null;
}

/** ينهي الجلسة على هذا العميل. التطبيق يمسح توكناته المحفوظة بنفسه. */
export async function endClientSession(request: Request): Promise<void> {
  if (!isNativeClient(request)) await clearSessionCookies();
}
