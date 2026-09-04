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
import { userIdParamSchema, setUserStatusSchema } from '@/shared/schemas/admin.schema';
import { setUserStatus } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/admin/users/:id/status
 * إيقاف أو تفعيل حساب — لا يمكن للإدارة تعديل حسابها الخاص أو حساب إداري آخر.
 */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-user-status');

  const { id } = validateParams(await context.params, userIdParamSchema);
  const input = await validateBody(request, setUserStatusSchema);

  const result = await setUserStatus(
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
