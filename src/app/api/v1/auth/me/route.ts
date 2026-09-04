import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { unauthorized } from '@/server/lib/errors';
import { getUserById } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/auth/me
 * المستخدم الحالي — تستخدمه شاشة Splash لتحديد الوجهة حسب الدور والحالة.
 */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'me');

  const session = await requireAuth(request);
  const user = await getUserById(session.id);

  // التوكن صالح لكن المستخدم حُذف — نعامله كجلسة منتهية
  if (!user) throw unauthorized('انتهت الجلسة. برجاء تسجيل الدخول مرة أخرى.');

  return ok({ user });
});
