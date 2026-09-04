import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateQuery } from '@/server/middleware/with-validation';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { created, ok } from '@/server/lib/api-response';
import {
  createProfessionSchema,
  listAdminProfessionsQuerySchema,
} from '@/shared/schemas/admin.schema';
import { createProfession, listProfessionsForAdmin } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/professions
 * كل المهن بما فيها المعطّلة، مع متطلبات مستنداتها الكاملة — تغذّي شاشة
 * تحرير محرّك المستندات الديناميكي.
 */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-professions');
  await requireRole(request, 'ADMIN');

  const query = validateQuery(request, listAdminProfessionsQuerySchema);
  const items = await listProfessionsForAdmin({
    categoryId: query.categoryId,
    includeInactive: query.includeInactive === 'true',
  });

  return ok(items, { total: items.length });
});

/**
 * POST /api/v1/admin/professions
 * ينشئ مهنة بمتطلبات مستنداتها. يرفض 422 عند تعارض `requiresQualification`
 * أو `requiresLicense` مع قائمة `documentRequirements` (ARCHITECTURE §3.3).
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-professions');

  const input = await validateBody(request, createProfessionSchema);
  const result = await createProfession(
    {
      id: admin.id,
      ip: getClientIdentifier(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
    input
  );

  return created(result);
});
