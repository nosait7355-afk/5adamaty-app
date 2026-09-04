import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams } from '@/server/middleware/with-validation';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { cancelOrderSchema, orderIdParamSchema } from '@/shared/schemas/order.schema';
import { cancelOrder } from '@/server/services/order.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/orders/:id/cancel
 * إلغاء الطلب — الزر الأحمر في الصورة 14.
 *
 * الجواز تقرّره الـState Machine وحدها: مسموح في NEW و ACCEPTED فقط، وأي
 * محاولة بعد بدء التنفيذ ترتد بـ409.
 */
export const POST = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'order-cancel');

  const { id } = validateParams(await context.params, orderIdParamSchema);
  const input = await validateBody(request, cancelOrderSchema);

  const order = await cancelOrder(user, id, input, {
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return ok(order);
});
