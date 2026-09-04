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
import { adminReviewIdParamSchema, setReviewVisibilitySchema } from '@/shared/schemas/admin.schema';
import { setReviewVisibility } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/admin/reviews/:id
 * يخفي أو يُظهر تقييمًا — لا يحذفه أبدًا (حفاظًا على أثر التدقيق).
 * متوسط تقييم المزوّد يُعاد حسابه من المراجعات الظاهرة فقط.
 */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-review-moderate');

  const { id } = validateParams(await context.params, adminReviewIdParamSchema);
  const input = await validateBody(request, setReviewVisibilitySchema);

  const result = await setReviewVisibility(
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
