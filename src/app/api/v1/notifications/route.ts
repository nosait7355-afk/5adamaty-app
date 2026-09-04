import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { listNotificationsQuerySchema } from '@/shared/schemas/account.schema';
import { listNotifications } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/notifications
 * الإشعارات — الصورة 15 بتبويباتها وعدّاداتها.
 * كل استعلام مقيّد بـ`userId` في المستودع، فلا يقرأ أحد إشعارات غيره.
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.READ, 'notifications');

  const query = validateQuery(request, listNotificationsQuerySchema);
  const result = await listNotifications(user, query);

  return ok(
    { items: result.items, counts: result.counts, unreadTotal: result.unreadTotal },
    { page: result.page, limit: result.limit, total: result.total, hasMore: result.hasMore }
  );
});
