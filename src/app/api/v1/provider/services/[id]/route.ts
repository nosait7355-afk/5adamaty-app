import { z } from 'zod';
import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { objectIdSchema } from '@/shared/schemas/common.schema';
import { updateProviderServiceSchema } from '@/shared/schemas/provider.schema';
import { deleteMyService, updateMyService } from '@/server/services/provider-services.service';

export const dynamic = 'force-dynamic';

const serviceParamSchema = z.object({ id: objectIdSchema }).strict();

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/provider/services/:id
 * تعديل خدمة يملكها مقدم الخدمة الحالي — لا يمكنه تعديل خدمة مزوّد آخر.
 */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'provider-services-update');

  const { id } = validateParams(await context.params, serviceParamSchema);
  const patch = await validateBody(request, updateProviderServiceSchema);
  const service = await updateMyService(user.id, id, patch);

  return ok(service);
});

/**
 * DELETE /api/v1/provider/services/:id
 * حذف خدمة — نهائي، لا سلة محذوفات.
 */
export const DELETE = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'provider-services-delete');

  const { id } = validateParams(await context.params, serviceParamSchema);
  await deleteMyService(user.id, id);

  return ok({ id });
});
