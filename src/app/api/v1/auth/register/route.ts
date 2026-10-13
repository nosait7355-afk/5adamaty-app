import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import { deliverSession, withSession } from '@/server/lib/session-transport';
import { created } from '@/server/lib/api-response';
import { registerCustomerSchema } from '@/shared/schemas/auth.schema';
import { registerCustomer } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/register
 * إنشاء حساب عميل — الصورة 05.
 *
 * لا OTP ولا تحقق بريد: الحساب يصبح ACTIVE فورًا، والتوثيق (شارة ✔)
 * يمنحه Admin يدويًا لاحقًا.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.AUTH, 'register');

  const input = await validateBody(request, registerCustomerSchema);

  const { user, tokens } = await registerCustomer(input, {
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  const session = await deliverSession(request, tokens, { remember: true });

  return created(withSession({ user }, session));
});
