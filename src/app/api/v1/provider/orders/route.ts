import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { listProviderOrdersQuerySchema } from '@/shared/schemas/order.schema';
import { listProviderOrders } from '@/server/services/provider-orders.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/provider/orders
 * «طلباتي» لمقدم الخدمة — الصورة 25: ستة تبويبات وبحث وترتيب.
 *
 * مسار منفصل عن `/orders` لأن الشكل مختلف: يحمل بيانات العميل والإجراءات
 * المتاحة، ويفلتر بتبويبات أدقّ.
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.READ, 'provider-orders');

  const query = validateQuery(request, listProviderOrdersQuerySchema);
  const result = await listProviderOrders(user, query);

  return ok(
    { items: result.items, counts: result.counts },
    { page: result.page, limit: result.limit, total: result.total, hasMore: result.hasMore }
  );
});
