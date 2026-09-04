import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { listThreadsQuerySchema } from '@/shared/schemas/account.schema';
import { listThreads } from '@/server/services/messaging.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/threads — قائمة المحادثات، أحدث نشاطًا أولًا. */
export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.READ, 'threads');

  const query = validateQuery(request, listThreadsQuerySchema);
  const result = await listThreads(user, query);

  return ok(
    { items: result.items, unreadTotal: result.unreadTotal },
    { page: result.page, limit: result.limit, total: result.total, hasMore: result.hasMore }
  );
});
