import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { getUnreadSummary } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/notifications/unread-count — شارات الجرس وتبويب الرسائل. */
export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.READ, 'unread-count');

  return ok(await getUnreadSummary(user));
});
