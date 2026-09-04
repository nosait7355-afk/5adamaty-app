import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { documentIdParamSchema } from '@/shared/schemas/upload.schema';
import { removeDocument } from '@/server/services/documents.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/v1/provider/documents/:id
 * يحذف المستند وأصله في Cloudinary معًا — تفاديًا للملفات اليتيمة.
 * ممنوع بعد اعتماد الحساب إلا من الإدارة.
 */
export const DELETE = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'document-delete');

  const user = await requireAuth(request);
  const { id } = validateParams(await context.params, documentIdParamSchema);

  await removeDocument(user, id);
  return ok({ deleted: true });
});
