import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { listCategoriesQuerySchema } from '@/shared/schemas/catalog.schema';
import { listCategories } from '@/server/services/catalog.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/categories
 * التصنيفات الرئيسية — الصورة 08.
 */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'categories');

  // includeInactive متاح للإدارة فقط؛ يُفعّل بحارس الدور في Phase 6
  const { includeInactive: _includeInactive } = validateQuery(request, listCategoriesQuerySchema);

  const categories = await listCategories(false);
  return ok(categories, { total: categories.length });
});
