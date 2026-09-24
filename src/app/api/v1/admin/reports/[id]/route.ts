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
import { reportIdParamSchema, resolveReportSchema } from '@/shared/schemas/report.schema';
import { resolveReport } from '@/server/services/report.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/admin/reports/:id — إغلاق بلاغ: «تمت المعالجة» أو «مرفوض».
 * إيقاف الملف نفسه يتم من صفحة مقدمي الخدمات.
 */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-report-resolve');

  const { id } = validateParams(await context.params, reportIdParamSchema);
  const input = await validateBody(request, resolveReportSchema);

  const result = await resolveReport(
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
