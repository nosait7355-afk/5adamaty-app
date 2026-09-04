import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { listFaqsQuerySchema } from '@/shared/schemas/account.schema';
import { listFaqs } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/faqs — الأسئلة الشائعة (الصورة 18).
 * عامة بلا مصادقة: مركز المساعدة يجب أن يعمل حتى قبل الدخول.
 */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'faqs');

  const query = validateQuery(request, listFaqsQuerySchema);
  const faqs = await listFaqs(query);

  return ok(faqs, { total: faqs.length });
});
