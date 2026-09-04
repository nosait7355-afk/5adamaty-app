import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { created } from '@/server/lib/api-response';
import { createReviewSchema } from '@/shared/schemas/account.schema';
import { orderIdParamSchema } from '@/shared/schemas/order.schema';
import { createReview } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/orders/:id/review
 * تقييم طلب مكتمل — الشاشة المشتقّة من زر «تقييم الخدمة» (الصورة 13).
 *
 * التقييم مسموح مرة واحدة لطلب مكتمل يخصّ هذا العميل. التكرار يرتدّ بـ409،
 * ويحرسه أيضًا فهرس فريد على `orderId` ضد السباق.
 */
export const POST = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'CUSTOMER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'order-review');

  const { id } = validateParams(await context.params, orderIdParamSchema);
  const input = await validateBody(request, createReviewSchema);

  return created(await createReview(user, id, input));
});
