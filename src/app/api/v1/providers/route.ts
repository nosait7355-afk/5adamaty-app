import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { discoveryQuerySchema } from '@/shared/schemas/catalog.schema';
import { listProviders } from '@/server/services/discovery.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/providers
 * قائمة مقدمي الخدمات المعتمدين — تغذّي «مقدمو خدمات مميزون» (الصورة 06)
 * ونتائج البحث عن مزوّد.
 *
 * المزوّدون غير المعتمدين مستبعدون داخل طبقة المستودع، لا هنا.
 */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'providers');

  const query = validateQuery(request, discoveryQuerySchema);
  const result = await listProviders(query);

  return ok(result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    hasMore: result.hasMore,
  });
});
