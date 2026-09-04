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
  adminProfessionIdParamSchema,
  updateProfessionSchema,
} from '@/shared/schemas/admin.schema';
import { updateProfession } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/admin/professions/:id
 *
 * المسار الذي يجعل شاشة المستندات (3/4) ديناميكية فعليًا: أي تعديل هنا
 * على `documentRequirements` أو `requiresQualification`/`requiresLicense`
 * ينعكس فورًا على تسجيل مقدمي الخدمة الجدد بلا نشر كود.
 */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-profession-update');

  const { id } = validateParams(await context.params, adminProfessionIdParamSchema);
  const input = await validateBody(request, updateProfessionSchema);

  const result = await updateProfession(
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
