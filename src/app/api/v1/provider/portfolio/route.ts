import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import {
  addPortfolioItemSchema,
  removePortfolioItemSchema,
} from '@/shared/schemas/provider.schema';
import { addPortfolioItem, removePortfolioItem } from '@/server/services/provider.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/provider/portfolio
 * إضافة صورة أو فيديو إلى «سابقة أعمالي».
 *
 * الجسم يحمل `publicId` فقط: الملف نفسه رُفع مباشرة من المتصفح إلى
 * Cloudinary، والسيرفر يستعلم عنه هناك ويحفظ بياناته هو — لا ادعاء العميل
 * (ARCHITECTURE §8).
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'provider-portfolio-add');

  const input = await validateBody(request, addPortfolioItemSchema);

  return ok(await addPortfolioItem(user.id, input));
});

/**
 * DELETE /api/v1/provider/portfolio
 * حذف عنصر من «سابقة أعمالي» — من القاعدة ومن Cloudinary معًا.
 *
 * `publicId` في الجسم لا في المسار: معرّفات Cloudinary تحوي شرطات مائلة
 * (`khadamaty/providers/<id>/…`)، فوضعها في segment يكسر التوجيه.
 */
export const DELETE = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'provider-portfolio-remove');

  const { publicId } = await validateBody(request, removePortfolioItemSchema);

  return ok(await removePortfolioItem(user.id, publicId));
});
