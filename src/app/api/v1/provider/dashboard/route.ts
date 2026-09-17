import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { getProviderDashboard } from '@/server/services/provider-dashboard.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/provider/dashboard
 * لوحة تحكم مقدم الخدمة — الصورة 24.
 *
 * مؤشرات عددية فقط — لا أرباح ولا رصيد ولا أي قيمة مالية.
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.READ, 'provider-dashboard');

  return ok(await getProviderDashboard(user));
});
