import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { forgotPasswordSchema } from '@/shared/schemas/auth.schema';
import { requestPasswordReset } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/forgot-password
 * رابط «نسيت كلمة المرور؟» في شاشة الدخول (الصورة 03).
 *
 * يعيد نجاحًا دائمًا سواء وُجد البريد أم لا — وإلا صار الرد أداة للتحقق
 * من وجود حساب ببريد معيّن (ARCHITECTURE §7).
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.AUTH, 'forgot-password');

  const { email } = await validateBody(request, forgotPasswordSchema);
  await requestPasswordReset(email);

  return ok({
    message: 'إذا كان البريد مسجّلًا لدينا فسيصلك رابط إعادة التعيين خلال دقائق.',
  });
});
