import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { listAdminReviewsQuerySchema } from '@/shared/schemas/admin.schema';
import { listReviews } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/reviews — كل التقييمات بما فيها المخفية إداريًا. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-reviews');
  await requireRole(request, 'ADMIN');

  const query = validateQuery(request, listAdminReviewsQuerySchema);
  const { items, total } = await listReviews({
    page: query.page,
    limit: query.limit,
    isVisible: query.isVisible === undefined ? undefined : query.isVisible === 'true',
    providerId: query.providerId,
  });

  return ok(items, { page: query.page, limit: query.limit, total });
});
