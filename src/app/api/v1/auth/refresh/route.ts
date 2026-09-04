import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  readTokenFromRequest,
  setSessionCookies,
} from '@/server/lib/cookies';
import { ok } from '@/server/lib/api-response';
import { unauthorized } from '@/server/lib/errors';
import { refreshSession } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/refresh
 * يدوّر توكن التحديث ويصدر توكن وصول جديدًا.
 *
 * إعادة استخدام توكن مُدوَّر تُبطل **كل** جلسات المستخدم — كشف سرقة التوكن.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'refresh');

  const refreshToken = readTokenFromRequest(request, REFRESH_COOKIE);
  if (!refreshToken) {
    await clearSessionCookies();
    throw unauthorized('انتهت الجلسة. برجاء تسجيل الدخول مرة أخرى.');
  }

  try {
    const { user, tokens } = await refreshSession(refreshToken, {
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    // الكوكي الجديدة دائمة — الجلسة كانت «تذكرني» أصلًا إن وصل التوكن
    await setSessionCookies({ ...tokens, remember: true });
    return ok({ user });
  } catch (error) {
    // أي فشل تحديث ينظّف الكوكيز حتى لا يعلق العميل في حلقة إعادة محاولة
    await clearSessionCookies();
    throw error;
  }
});
