import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { listUsersQuerySchema } from '@/shared/schemas/admin.schema';
import { listUsers } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/users — قائمة المستخدمين بفلترة الدور والحالة والبحث. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-users');
  await requireRole(request, 'ADMIN');

  const query = validateQuery(request, listUsersQuerySchema);
  const { items, total } = await listUsers(query);

  return ok(items, { page: query.page, limit: query.limit, total });
});
