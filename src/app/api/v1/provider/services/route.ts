import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { created, ok } from '@/server/lib/api-response';
import {
  createProviderServiceSchema,
  listMyServicesQuerySchema,
} from '@/shared/schemas/provider.schema';
import { createMyService, listMyServices } from '@/server/services/provider-services.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/provider/services
 * قائمة خدمات مقدم الخدمة الحالي — صفحة «خدماتي».
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.READ, 'provider-services-list');

  const query = validateQuery(request, listMyServicesQuerySchema);
  const result = await listMyServices(user.id, { page: query.page, limit: query.limit });

  return ok(result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    hasMore: result.hasMore,
  });
});

/**
 * POST /api/v1/provider/services
 * إضافة خدمة جديدة — تصنيفها ومهنتها من ملف المزوّد نفسه، لا يختارهما العميل.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'provider-services-create');

  const input = await validateBody(request, createProviderServiceSchema);
  const service = await createMyService(user.id, input);

  return created(service);
});
