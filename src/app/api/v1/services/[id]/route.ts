import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { serviceIdParamSchema } from '@/shared/schemas/catalog.schema';
import { getService } from '@/server/services/discovery.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/services/:id
 * تفاصيل خدمة — يغذّي بطاقة المزوّد والسعر المبدئي في شاشة طلب الخدمة (11).
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'service-detail');

  const { id } = validateParams(await context.params, serviceIdParamSchema);
  const service = await getService(id);

  return ok(service);
});
