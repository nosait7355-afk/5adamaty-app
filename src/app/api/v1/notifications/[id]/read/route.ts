import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { notificationIdParamSchema } from '@/shared/schemas/account.schema';
import { readNotification } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/v1/notifications/:id/read — إشعار مستخدم آخر يعيد 404 لا 403. */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'notification-read');

  const { id } = validateParams(await context.params, notificationIdParamSchema);

  return ok(await readNotification(user, id));
});
