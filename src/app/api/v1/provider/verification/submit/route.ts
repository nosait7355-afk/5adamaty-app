import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { getClientIdentifier } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { submitVerificationSchema } from '@/shared/schemas/provider.schema';
import { submitVerification } from '@/server/services/provider.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/provider/verification/submit
 * إرسال طلب التسجيل — زر «إرسال طلب التسجيل» في الصورة 22.
 *
 * يتحقق **على الخادم** من اكتمال المستندات الإلزامية لمهنة المزوّد قبل
 * النقل إلى `PENDING_REVIEW`، ويسجّل الانتقال في `auditLogs` وينشئ إشعارًا.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireRole(request, 'PROVIDER');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'verification-submit');

  await validateBody(request, submitVerificationSchema);

  const profile = await submitVerification(user.id, {
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return ok(profile);
});
