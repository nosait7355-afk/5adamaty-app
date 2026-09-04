import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { orderIdParamSchema } from '@/shared/schemas/order.schema';
import { getOrder } from '@/server/services/order.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/orders/:id
 * تفاصيل الطلب — الصورة 14.
 *
 * من ليس طرفًا في الطلب يحصل على **404** لا 403 (ARCHITECTURE §7).
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.READ, 'order-detail');

  const { id } = validateParams(await context.params, orderIdParamSchema);

  return ok(await getOrder(user, id));
});
