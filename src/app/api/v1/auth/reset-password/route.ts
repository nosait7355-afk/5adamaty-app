import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import { clearSessionCookies } from '@/server/lib/cookies';
import { ok } from '@/server/lib/api-response';
import { resetPasswordSchema } from '@/shared/schemas/auth.schema';
import { resetPassword } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/reset-password
 *
 * التوكن صالح 30 دقيقة ويُستخدم مرة واحدة. تغيير كلمة المرور يُبطل
 * **كل** الجلسات على كل الأجهزة — لأن من يستعيد حسابه قد يكون مخترَقًا.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.AUTH, 'reset-password');

  const input = await validateBody(request, resetPasswordSchema);
  await resetPassword({ token: input.token, password: input.password });

  // ننظّف كوكيز هذا الجهاز أيضًا ليعيد الدخول بكلمة المرور الجديدة
  await clearSessionCookies();

  return ok({ message: 'تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.' });
});
