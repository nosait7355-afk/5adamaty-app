import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { listAuditLogsQuerySchema } from '@/shared/schemas/admin.schema';
import { listAuditLogs } from '@/server/services/admin.service';
import type { AuditAction } from '@/server/db/models/misc.model';
import { AUDIT_ACTIONS } from '@/server/db/models';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/audit-logs — سجل كل الإجراءات الحسّاسة، للقراءة فقط. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-audit-logs');
  await requireRole(request, 'ADMIN');

  const query = validateQuery(request, listAuditLogsQuerySchema);
  const action =
    query.action && (AUDIT_ACTIONS as readonly string[]).includes(query.action)
      ? (query.action as AuditAction)
      : undefined;

  const { items, total } = await listAuditLogs({
    page: query.page,
    limit: query.limit,
    entityType: query.entityType,
    action,
  });

  return ok(items, { page: query.page, limit: query.limit, total });
});
