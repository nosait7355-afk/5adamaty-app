import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { convertToProviderSchema } from '@/shared/schemas/provider.schema';
import { convertCustomerToProvider } from '@/server/services/provider.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/me/become-provider
 * يبدأ تحويل عميل مسجَّل إلى مقدم خدمة: ينشئ ملف مزوّد بحالة `DRAFT`
 * ويكمل بيانات المستخدم الناقصة.
 *
 * `requireAuth` لا `requireRole('CUSTOMER')`: الدور لا يتغيّر إلا عند
 * إرسال الطلب، فقد يعود صاحب مسودة إلى هنا وهو ما يزال عميلًا. الخدمة
 * نفسها ترفض الحساب الإداري وتكتفي بالتحديث إن كان الملف قائمًا.
 *
 * لا يُفعّل شيئًا: الحساب يبقى حساب عميل عاملًا حتى ترفع الهوية ويُرسل
 * الطلب من `POST /provider/verification/submit`.
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'become-provider');

  const input = await validateBody(request, convertToProviderSchema);

  return ok(await convertCustomerToProvider(user.id, input));
});
