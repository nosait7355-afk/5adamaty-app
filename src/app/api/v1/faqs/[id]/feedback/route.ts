import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { faqFeedbackSchema, notificationIdParamSchema } from '@/shared/schemas/account.schema';
import { submitFaqFeedback } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/faqs/:id/feedback — «مفيد 🙂 / غير مفيد 🙁» (الصورة 18).
 *
 * عدّاد مجهول بلا هوية المصوّت: لا نربط رأي المستخدم بحسابه، فالغرض قياس
 * جودة الإجابة لا تتبّع من قرأها.
 */
export const POST = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'faq-feedback');

  const { id } = validateParams(await context.params, notificationIdParamSchema);
  const { helpful } = await validateBody(request, faqFeedbackSchema);

  await submitFaqFeedback(id, helpful);

  return ok({ recorded: true });
});
