import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams } from '@/server/middleware/with-validation';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { completeOrderSchema, orderIdParamSchema } from '@/shared/schemas/order.schema';
import { completeOrder } from '@/server/services/provider-orders.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/orders/:id/complete
 * إكمال الطلب بتأكيد استلام المبلغ — الصورتان 28 و29.
 *
 * يتطلب `cashReceivedConfirmed: true` و`serviceCompleted: true` حرفيًا.
 * غياب أيهما يرتد بـ400 من المخطط، ولو تجاوزه أحد بطريقة ما ترفضه
 * الـState Machine ثم نموذج قاعدة البيانات.
 *
 * ⚠️ لا يُنشئ هذا المسار أي سجل مالي — الدفع تمّ نقدًا خارج التطبيق.
 */
export const POST = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'order-complete');

  const { id } = validateParams(await context.params, orderIdParamSchema);
  const input = await validateBody(request, completeOrderSchema);

  const order = await completeOrder(user, id, input, {
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return ok(order);
});
