import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { listProfessionsQuerySchema } from '@/shared/schemas/catalog.schema';
import { getCategoryBySlug, listProfessions } from '@/server/services/catalog.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/professions?categoryId=...&categorySlug=...
 * المهن داخل تصنيف — الصورة 07، وتغذّي «التخصص الدقيق» في الصورة 20.
 */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'professions');

  const query = validateQuery(request, listProfessionsQuerySchema);

  let categoryId = query.categoryId;
  if (!categoryId && query.categorySlug) {
    const category = await getCategoryBySlug(query.categorySlug);
    categoryId = category.id;
  }

  const professions = await listProfessions(categoryId);
  return ok(professions, { total: professions.length });
});
