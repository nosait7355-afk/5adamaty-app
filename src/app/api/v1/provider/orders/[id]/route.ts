import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { orderIdParamSchema } from '@/shared/schemas/order.schema';
import { getProviderOrder } from '@/server/services/provider-orders.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/provider/orders/:id
 * تفاصيل الطلب من جانب المزوّد — الصور 26 إلى 29.
 *
 * مسار منفصل عن `/orders/:id` لأن الشكل مختلف: يحمل بيانات العميل
 * والإجراءات المتاحة. نفس حارس IDOR — من ليس طرفًا يحصل على 404.
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.READ, 'provider-order-detail');

  const { id } = validateParams(await context.params, orderIdParamSchema);

  return ok(await getProviderOrder(user, id));
});
