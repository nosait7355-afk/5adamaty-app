import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { ok } from '@/server/lib/api-response';
import { providerIdParamSchema } from '@/shared/schemas/catalog.schema';
import { getProviderContact } from '@/server/services/discovery.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/providers/:id/contact
 * روابط «اتصل الآن» و«واتساب» لمقدم خدمة.
 *
 * يتطلب تسجيل دخول: الأرقام لا تُعاد في أي مسار عام، فلا يجمعها زائر
 * مجهول آليًا. لا يُسجَّل الاستدعاء ولا يُنشئ إشعارًا.
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'provider-contact');
  await requireAuth(request);

  const { id } = validateParams(await context.params, providerIdParamSchema);
  return ok(await getProviderContact(id));
});
