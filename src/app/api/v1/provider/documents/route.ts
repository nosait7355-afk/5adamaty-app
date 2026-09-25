import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireProviderWorkspace } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { created, ok } from '@/server/lib/api-response';
import { saveDocumentSchema } from '@/shared/schemas/upload.schema';
import { listMyDocuments, saveDocument } from '@/server/services/documents.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/provider/documents
 * مستندات المزوّد الحالي + متطلبات مهنته + حالة الاكتمال.
 * لا تعيد أي رابط — الروابط تُطلب فرديًا من endpoint موقّت.
 */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'documents-list');
  const user = await requireProviderWorkspace(request, 'ADMIN');
  return ok(await listMyDocuments(user));
});

/**
 * POST /api/v1/provider/documents
 * يحفظ metadata فقط — الملف نفسه رُفع مباشرة إلى Cloudinary.
 * يتحقق من الأصل لدى Cloudinary قبل الحفظ فلا يُصدَّق ادعاء العميل.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'documents-save');

  const user = await requireProviderWorkspace(request, 'ADMIN');
  const input = await validateBody(request, saveDocumentSchema);

  return created({ document: await saveDocument(user, input) });
});
