import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import { endClientSession, readPresentedRefreshToken } from '@/server/lib/session-transport';
import { ok } from '@/server/lib/api-response';
import { logout } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/logout
 * زر «تسجيل الخروج» الأحمر في شاشة حسابي (الصورة 16).
 *
 * `?all=true` ينهي الجلسات على كل الأجهزة.
 * ينجح دائمًا حتى بلا جلسة — تسجيل الخروج لا يجوز أن يفشل.
 * التطبيق يرسل `{ refreshToken }` في الجسم ليُبطَل على الخادم، لا محليًا فقط.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'logout');

  const allDevices = new URL(request.url).searchParams.get('all') === 'true';
  const refreshToken = await readPresentedRefreshToken(request);

  await logout(refreshToken, { allDevices });
  await endClientSession(request);

  return ok({ loggedOut: true });
});
