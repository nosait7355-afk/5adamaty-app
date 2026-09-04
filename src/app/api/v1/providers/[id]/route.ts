import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { providerIdParamSchema } from '@/shared/schemas/catalog.schema';
import { getProvider } from '@/server/services/discovery.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/providers/:id
 * ملف مقدم الخدمة — الصورة 10.
 *
 * مزوّد قيد المراجعة يعيد 404 لا 403: لا نكشف حتى وجوده (ARCHITECTURE §7).
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'provider-detail');

  const { id } = validateParams(await context.params, providerIdParamSchema);
  const provider = await getProvider(id);

  return ok(provider);
});
