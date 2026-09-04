import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import { setSessionCookies } from '@/server/lib/cookies';
import { ok } from '@/server/lib/api-response';
import { loginSchema } from '@/shared/schemas/auth.schema';
import { login } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/login
 * تسجيل الدخول برقم هاتف أو بريد + كلمة مرور — الصورة 03.
 *
 * لا OTP ولا Social Login (PROJECT_PLAN — المصادقة).
 * حد المعدّل 5/دقيقة + قفل الحساب بعد 5 محاولات فاشلة.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.AUTH, 'login');

  const input = await validateBody(request, loginSchema);

  const { user, tokens } = await login(input, {
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  await setSessionCookies({ ...tokens, remember: input.remember });

  return ok({ user });
});
