import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { searchQuerySchema } from '@/shared/schemas/catalog.schema';
import { search } from '@/server/services/discovery.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/search?q=...&type=all|services|providers
 * البحث الموحّد — الشاشة المشتقّة من حقل البحث في الصور 06–09.
 *
 * حدّ معدّل أضيق من بقية القراءة (30/دقيقة): كل استدعاء يمسّ فهرسًا نصيًا،
 * والواجهة تستدعيه بـdebounce مع الكتابة.
 */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.SEARCH, 'search');

  const query = validateQuery(request, searchQuerySchema);
  const result = await search(query);

  return ok(result, {
    page: query.page,
    limit: query.limit,
    total: result.totals.services + result.totals.providers,
  });
});
