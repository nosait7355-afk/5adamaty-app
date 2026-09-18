import { withErrorHandler } from '@/server/middleware/with-error-handler';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { validateBody } from '@/server/middleware/with-validation';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { clearSessionCookies } from '@/server/lib/cookies';
import { ok } from '@/server/lib/api-response';
import { getAccountSummary } from '@/server/services/account.service';
import { deleteMyAccount } from '@/server/services/account-deletion.service';
import { deleteAccountSchema } from '@/shared/schemas/account.schema';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/me/account — ملخّص «حسابي» (الصورة 16).
 *
 * ⚠️ «وسائل الدفع» يعود **نصًّا معلوماتيًا** لا قيمة عددية ولا كيانًا —
 * قيمته في التصميم نفسه `—`، والدفع كاش خارج التطبيق (ARCHITECTURE §0.1).
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.READ, 'account-summary');

  return ok(await getAccountSummary(user));
});

/**
 * DELETE /api/v1/me/account — حذف الحساب نهائيًا.
 *
 * حدّ معدّل المصادقة (5/دقيقة) لا حدّ الكتابة: المسار يتحقق من كلمة
 * المرور، فهو هدف تخمين لمن يستولي على جلسة مفتوحة.
 */
export const DELETE = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.AUTH, 'account-delete');

  const input = await validateBody(request, deleteAccountSchema);
  const result = await deleteMyAccount(user, input, {
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  await clearSessionCookies();
  return ok(result);
});
