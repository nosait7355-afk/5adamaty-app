import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { uploadSignatureSchema } from '@/shared/schemas/upload.schema';
import { issueUploadSignature } from '@/server/services/upload.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/uploads/signature
 *
 * يصدر توقيعًا لعملية رفع واحدة بعد التحقق من الدور والنوع الحقيقي والحجم.
 * التوقيع يثبّت المجلد والمعرّف ونوع الوصول والصيغ والحد الأقصى — فلا يستطيع
 * العميل تغيير أي منها، وأي تعديل يجعل Cloudinary ترفض الرفعة.
 *
 * السرّ نفسه لا يغادر السيرفر إطلاقًا (ARCHITECTURE §8).
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.UPLOAD, 'upload-signature');

  const user = await requireAuth(request);
  const input = await validateBody(request, uploadSignatureSchema);

  return ok(issueUploadSignature(user, input));
});
