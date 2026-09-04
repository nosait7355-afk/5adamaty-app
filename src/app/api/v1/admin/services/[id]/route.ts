import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams } from '@/server/middleware/with-validation';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import {
  adminServiceIdParamSchema,
  setServiceActiveSchema,
} from '@/shared/schemas/admin.schema';
import { setServiceActive } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/v1/admin/services/:id — إظهار أو إخفاء خدمة من الاكتشاف. */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-service-moderate');

  const { id } = validateParams(await context.params, adminServiceIdParamSchema);
  const input = await validateBody(request, setServiceActiveSchema);

  const result = await setServiceActive(
    {
      id: admin.id,
      ip: getClientIdentifier(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
    id,
    input
  );

  return ok(result);
});
