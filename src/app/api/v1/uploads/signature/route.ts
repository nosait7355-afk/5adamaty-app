import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth, type SessionUser } from '@/server/middleware/with-auth';
import { findProviderByUserId } from '@/server/repositories/provider.repository';
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

  return ok(issueUploadSignature(await effectiveUploader(user), input));
});

/**
 * الدور الفعّال لأغراض الرفع.
 *
 * عميل يحوّل حسابه إلى مقدم خدمة يظل `CUSTOMER` حتى يرسل طلبه، لكنه يحتاج
 * قبل ذلك رفع هويته — وهي `PROVIDER_DOCUMENT` المقصورة على المزوّدين. فبدل
 * توسيع القاعدة لكل عميل (وهو ما يفتح رفع المستندات للجميع)، نرقّي دوره
 * هنا فقط **إن كان يملك ملف مزوّد فعلًا**، وهو نفس شرط
 * `requireProviderWorkspace`.
 *
 * المجلد يبقى مبنيًا على `user.id` داخل `issueUploadSignature`، فلا يمسّ
 * هذا الترقية شيئًا من عزل الملفات.
 */
async function effectiveUploader(user: SessionUser): Promise<SessionUser> {
  if (user.role !== 'CUSTOMER') return user;

  const provider = await findProviderByUserId(user.id);
  return provider ? { ...user, role: 'PROVIDER' } : user;
}
