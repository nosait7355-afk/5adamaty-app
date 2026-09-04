import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import { setSessionCookies } from '@/server/lib/cookies';
import { created } from '@/server/lib/api-response';
import { registerProviderSchema } from '@/shared/schemas/provider.schema';
import { registerProvider } from '@/server/services/provider.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/register-provider
 * إنشاء حساب مقدم خدمة من بيانات الخطوتين 1/4 و2/4 (الصور 19 و20).
 *
 * ينتهي بحالة `DRAFT`: الحساب موجود والجلسة مفتوحة ليصير رفع المستندات
 * ممكنًا (الخطوة 3/4)، لكن الطلب لا يدخل طابور المراجعة حتى يُرسَل صراحةً
 * من الخطوة 4/4.
 *
 * لا OTP ولا تحقق بريد — التوثيق قرار إداري يدوي (PROJECT_PLAN — المصادقة).
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.AUTH, 'register-provider');

  const input = await validateBody(request, registerProviderSchema);

  const { user, providerId, tokens } = await registerProvider(input, {
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  await setSessionCookies({ ...tokens, remember: true });

  return created({ user, providerId });
});
