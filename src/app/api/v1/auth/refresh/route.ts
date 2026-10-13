import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import {
  deliverSession,
  endClientSession,
  readPresentedRefreshToken,
  withSession,
} from '@/server/lib/session-transport';
import { ok } from '@/server/lib/api-response';
import { unauthorized } from '@/server/lib/errors';
import { refreshSession } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/refresh
 * يدوّر توكن التحديث ويصدر توكن وصول جديدًا.
 *
 * إعادة استخدام توكن مُدوَّر تُبطل **كل** جلسات المستخدم — كشف سرقة التوكن.
 *
 * الموقع: التوكن من الكوكي. التطبيق: من الجسم `{ refreshToken }` ويستلم
 * الزوج الجديد في `session` — ويجب أن يستبدل المحفوظ فورًا، فالقديم صار
 * مُبطَلًا وإعادة تقديمه تُنهي كل جلساته.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'refresh');

  const refreshToken = await readPresentedRefreshToken(request);
  if (!refreshToken) {
    await endClientSession(request);
    throw unauthorized('انتهت الجلسة. برجاء تسجيل الدخول مرة أخرى.');
  }

  try {
    const { user, tokens } = await refreshSession(refreshToken, {
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    // الكوكي الجديدة دائمة — الجلسة كانت «تذكرني» أصلًا إن وصل التوكن
    const session = await deliverSession(request, tokens, { remember: true });
    return ok(withSession({ user }, session));
  } catch (error) {
    // أي فشل تحديث ينظّف الكوكيز حتى لا يعلق العميل في حلقة إعادة محاولة
    await endClientSession(request);
    throw error;
  }
});
