import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { listAdminReportsQuerySchema } from '@/shared/schemas/report.schema';
import { listReportsForAdmin } from '@/server/services/report.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/reports — بلاغات المستخدمين عن مقدمي الخدمات. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-reports');
  await requireRole(request, 'ADMIN');

  const query = validateQuery(request, listAdminReportsQuerySchema);
  const { items, total } = await listReportsForAdmin(query);

  return ok(items, { page: query.page, limit: query.limit, total });
});
