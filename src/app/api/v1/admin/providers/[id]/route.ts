import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { providerIdParamSchema } from '@/shared/schemas/catalog.schema';
import { getProviderForAdmin } from '@/server/services/provider.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/admin/providers/:id
 * تفاصيل طلب توثيق للمراجعة — بياناته ومستنداته وحالة اكتمالها.
 *
 * المستندات تُعاد بمعرّفاتها فقط بلا روابط؛ الرابط الموقّت يُطلب من
 * `/provider/documents/:id/url` عند فتح المستند فعليًا.
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-provider-detail');

  const { id } = validateParams(await context.params, providerIdParamSchema);

  return ok(await getProviderForAdmin(id));
});
