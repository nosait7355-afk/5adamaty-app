import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { readAllNotifications } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

/** POST /api/v1/notifications/read-all — «تعليم الكل كمقروء». */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'notifications-read-all');

  return ok(await readAllNotifications(user));
});
