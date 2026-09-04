import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { getDashboard } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/dashboard — إحصاءات لوحة الإدارة. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-dashboard');
  await requireRole(request, 'ADMIN');

  return ok(await getDashboard());
});
