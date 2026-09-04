import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateQuery } from '@/server/middleware/with-validation';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { created, ok } from '@/server/lib/api-response';
import { createOrderSchema, listOrdersQuerySchema } from '@/shared/schemas/order.schema';
import { createOrder, listMyOrders } from '@/server/services/order.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/orders
 * «طلباتي» للعميل — الصورة 13، بتبويباتها وعدّاداتها.
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireRole(request, 'CUSTOMER', 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.READ, 'orders-list');

  const query = validateQuery(request, listOrdersQuerySchema);
  const result = await listMyOrders(user, query);

  return ok(
    { items: result.items, counts: result.counts },
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasMore: result.hasMore,
    }
  );
});

/**
 * POST /api/v1/orders
 * إنشاء طلب خدمة — الصورة 11.
 *
 * لا حقل دفع في المدخلات ولا في المخرجات: `paymentMethod` يثبّته الخادم على
 * القيمة الوحيدة الممكنة، والسعر يأتي من المزوّد لا من العميل.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'CUSTOMER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'orders-create');

  const input = await validateBody(request, createOrderSchema);

  const order = await createOrder(user, input, {
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return created(order);
});
