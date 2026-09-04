import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { supportContactSchema } from '@/shared/schemas/account.schema';
import { contactSupport } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/support/contact — «تواصل معنا» (الصورة 18).
 *
 * حدّ المعدّل مشدّد (WRITE) لأن هذا المسار الوحيد الذي يُنشئ محتوى نصيًا
 * حرًّا يصل للإدارة — فلا يصير قناة إغراق.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'support-contact');

  const input = await validateBody(request, supportContactSchema);

  return ok(await contactSupport(user, input));
});
