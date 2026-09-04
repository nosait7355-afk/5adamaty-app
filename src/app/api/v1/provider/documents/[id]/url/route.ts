import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { documentIdParamSchema } from '@/shared/schemas/upload.schema';
import { getDocumentUrl } from '@/server/services/documents.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/provider/documents/:id/url
 *
 * رابط عرض موقّت لمستند حسّاس. يُصدر عند الطلب ولا يُخزَّن.
 * غير المالك يتلقى **404** لا 403 — منعًا لتعداد المعرّفات (ARCHITECTURE §7).
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'document-url');

  const user = await requireAuth(request);
  const { id } = validateParams(await context.params, documentIdParamSchema);

  return ok(await getDocumentUrl(user, id));
});
