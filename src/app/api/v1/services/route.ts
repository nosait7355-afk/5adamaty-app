import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { discoveryQuerySchema } from '@/shared/schemas/catalog.schema';
import { listServices } from '@/server/services/discovery.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/services
 * قائمة الخدمات داخل تصنيف/مهنة مع الفلاتر والترتيب — الصورة 09.
 *
 * خدمات المزوّدين غير المعتمدين لا تظهر: الحارس مطبَّق على المزوّد المضموم
 * داخل خط أنابيب التجميع.
 */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'services');

  const query = validateQuery(request, discoveryQuerySchema);
  const result = await listServices(query);

  return ok(result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    hasMore: result.hasMore,
  });
});
