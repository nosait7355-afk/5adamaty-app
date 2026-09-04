import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { updateProfileSchema } from '@/shared/schemas/account.schema';
import { updateProfile } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/v1/me/profile — «تعديل الملف الشخصي» (الصورة 16).
 *
 * المخطط لا يحوي `role` ولا `status` ولا `phone`: تغيير الهاتف يغيّر معرّف
 * الدخول نفسه، وهو إجراء أمني منفصل لا حقل في نموذج ملف.
 */
export const PATCH = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'profile-update');

  const input = await validateBody(request, updateProfileSchema);

  return ok(await updateProfile(user, input));
});
