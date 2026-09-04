import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { categorySlugParamSchema } from '@/shared/schemas/catalog.schema';
import { getCategoryBySlug, listProfessions } from '@/server/services/catalog.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * GET /api/v1/categories/:slug
 * تصنيف واحد ومهنه — يغذّي شاشة «الخدمات داخل التصنيف» (الصورة 09).
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'category-detail');

  const { slug } = validateParams(await context.params, categorySlugParamSchema);

  const category = await getCategoryBySlug(slug);
  const professions = await listProfessions(category.id);

  return ok({ category, professions });
});
