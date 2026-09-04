import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams, validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { providerIdParamSchema, reviewsQuerySchema } from '@/shared/schemas/catalog.schema';
import { listProviderReviews } from '@/server/services/discovery.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/providers/:id/reviews
 * تبويب «التقييمات» في ملف مقدم الخدمة (الصورة 10).
 *
 * التقييمات المخفية إداريًا لا تُعاد، ولا يُعاد أي حقل اتصال لصاحب التقييم.
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'provider-reviews');

  const { id } = validateParams(await context.params, providerIdParamSchema);
  const { page, limit } = validateQuery(request, reviewsQuerySchema);

  const result = await listProviderReviews(id, { page, limit });

  return ok(
    { items: result.items, breakdown: result.breakdown },
    { page, limit, total: result.total, hasMore: page * limit < result.total }
  );
});
