import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { listAdminOrdersQuerySchema } from '@/shared/schemas/admin.schema';
import { listOrders } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/orders — قراءة إشرافية على كل الطلبات، بلا تعديل حالة. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-orders');
  await requireRole(request, 'ADMIN');

  const query = validateQuery(request, listAdminOrdersQuerySchema);
  const { items, total } = await listOrders(query);

  return ok(items, { page: query.page, limit: query.limit, total });
});
