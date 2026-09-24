import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { created } from '@/server/lib/api-response';
import { providerIdParamSchema } from '@/shared/schemas/catalog.schema';
import { createReportSchema } from '@/shared/schemas/report.schema';
import { createReport } from '@/server/services/report.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/providers/:id/report — «إبلاغ عن مقدم الخدمة».
 * مطلب سياسة Google Play للمحتوى الذي ينشئه المستخدمون (UGC).
 */
export const POST = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'provider-report');
  const session = await requireAuth(request);

  const { id } = validateParams(await context.params, providerIdParamSchema);
  const input = await validateBody(request, createReportSchema);

  return created(await createReport(session, id, input));
});
