import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { adminOrderIdParamSchema } from '@/shared/schemas/admin.schema';
import { getOrderForAdmin } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/v1/admin/orders/:id — تفاصيل طلب لأغراض الدعم والتدقيق. */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-order-detail');
  await requireRole(request, 'ADMIN');

  const { id } = validateParams(await context.params, adminOrderIdParamSchema);
  return ok(await getOrderForAdmin(id));
});
