import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { getAccountSummary } from '@/server/services/account.service';

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
