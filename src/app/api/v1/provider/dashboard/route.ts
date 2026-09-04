import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { getProviderDashboard } from '@/server/services/provider-orders.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/provider/dashboard
 * لوحة تحكم مقدم الخدمة — الصورة 24.
 *
 * «الأرباح» تقرير إحصائي مشتق من الطلبات المكتملة المحصّلة كاش خارج
 * التطبيق — لا رصيد ولا محفظة ولا سجل مالي (ARCHITECTURE §0.1).
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.READ, 'provider-dashboard');

  return ok(await getProviderDashboard(user));
});
