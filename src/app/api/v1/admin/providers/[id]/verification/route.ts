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
import { providerIdParamSchema } from '@/shared/schemas/catalog.schema';
import { verificationDecisionSchema } from '@/shared/schemas/provider.schema';
import { decideVerification } from '@/server/services/provider.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/admin/providers/:id/verification
 * قرار الإدارة: APPROVED / REJECTED / RESUBMISSION_REQUIRED.
 *
 * المسار **الوحيد** الذي يكتب `verification.status` و`isVerifiedBadge`
 * و`isActive`. محروس بـADMIN، ويسجّل كل قرار في `auditLogs` مع الحالة قبل
 * وبعد، وينشئ إشعارًا لمقدم الخدمة.
 */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-verification');

  const { id } = validateParams(await context.params, providerIdParamSchema);
  const decision = await validateBody(request, verificationDecisionSchema);

  const result = await decideVerification({ id: admin.id }, id, decision, {
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return ok(result);
});
