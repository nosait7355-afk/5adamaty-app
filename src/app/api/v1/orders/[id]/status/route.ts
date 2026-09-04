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
import { orderIdParamSchema, updateOrderStatusSchema } from '@/shared/schemas/order.schema';
import { updateOrderStatus } from '@/server/services/provider-orders.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/orders/:id/status
 * قبول / رفض / بدء التنفيذ / في الطريق — الصورتان 26 و27.
 *
 * `COMPLETED` **غير مقبولة هنا**: مخطط الإدخال لا يحتويها، فلا يمكن
 * الالتفاف على شرط تأكيد استلام المبلغ عبر هذا المسار.
 *
 * «في الطريق» تغيير حالة يدوي بحت — لا GPS ولا موقع ولا ETA.
 */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'order-status');

  const { id } = validateParams(await context.params, orderIdParamSchema);
  const input = await validateBody(request, updateOrderStatusSchema);

  const order = await updateOrderStatus(user, id, input, {
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return ok(order);
});
