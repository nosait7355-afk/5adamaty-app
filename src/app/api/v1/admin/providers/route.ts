import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { adminProvidersQuerySchema } from '@/shared/schemas/provider.schema';
import { listVerificationQueue } from '@/server/services/provider.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/providers?status=PENDING_REVIEW
 * طابور مراجعة التوثيق — شاشة الإدارة الأولية.
 *
 * ADMIN فقط. هذا هو المسار الوحيد في النظام الذي يخرج فيه هاتف مقدم
 * الخدمة أو بريده، لأن المراجعة تستلزم التواصل معه.
 */
export const GET = withErrorHandler(async (request) => {
  await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-providers');

  const query = validateQuery(request, adminProvidersQuerySchema);
  const result = await listVerificationQueue(query);

  return ok(result.items, {
    page: query.page,
    limit: query.limit,
    total: result.total,
    hasMore: query.page * query.limit < result.total,
  });
});
