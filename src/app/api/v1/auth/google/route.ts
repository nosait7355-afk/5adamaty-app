import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import { setSessionCookies } from '@/server/lib/cookies';
import { ok } from '@/server/lib/api-response';
import { googleAuthSchema } from '@/shared/schemas/auth.schema';
import { loginWithGoogle } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/google
 * تسجيل الدخول أو إنشاء حساب عميل عبر جوجل — يدخل أو يُنشئ حسابًا من
 * `idToken` تحقّقت منه Google، بلا OTP وبلا كلمة مرور.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.AUTH, 'auth-google');

  const input = await validateBody(request, googleAuthSchema);

  const { user, tokens } = await loginWithGoogle(
    input.idToken,
    { userAgent: request.headers.get('user-agent') ?? undefined },
    { allowCreate: input.intent === 'register' }
  );

  await setSessionCookies({ ...tokens, remember: true });

  return ok({ user });
});
