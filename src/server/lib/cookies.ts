import { cookies } from 'next/headers';
import { isProduction } from './env';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './jwt';

/**
 * كوكيز الجلسة (ARCHITECTURE §7).
 *
 * `httpOnly` : JavaScript لا يستطيع قراءتها — يحيّد سرقة التوكن بـXSS.
 * `secure`   : HTTPS فقط في الإنتاج.
 * `sameSite` : `lax` — خط الدفاع الأول ضد CSRF، ويسمح بالتنقّل العادي.
 * `path: /`  : متاحة لكل المسارات بما فيها /api.
 *
 * لا يُخزَّن أي توكن في localStorage أو sessionStorage إطلاقًا.
 */

export const ACCESS_COOKIE = 'kf_at';
export const REFRESH_COOKIE = 'kf_rt';

const baseOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
} as const;

export async function setSessionCookies(tokens: {
  accessToken: string;
  refreshToken: string;
  /** «تذكرني» — يجعل كوكي التحديث دائمًا بدل جلسة المتصفح. */
  remember: boolean;
}): Promise<void> {
  const store = await cookies();

  store.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions,
    // بلا maxAge = كوكي جلسة يزول بإغلاق المتصفح
    ...(tokens.remember ? { maxAge: REFRESH_TOKEN_TTL_SECONDS } : {}),
  });
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, '', { ...baseOptions, maxAge: 0 });
  store.set(REFRESH_COOKIE, '', { ...baseOptions, maxAge: 0 });
}

export async function readAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

/** يقرأ التوكن من رؤوس الطلب — للسياقات التي لا تتوفر فيها `cookies()`. */
export function readTokenFromRequest(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}
