import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireProviderWorkspace } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { updateProviderProfileSchema } from '@/shared/schemas/provider.schema';
import {
  getMyProviderProfile,
  updateMyProviderProfile,
} from '@/server/services/provider.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/provider/profile
 * ملف مقدم الخدمة الحالي: بياناته، حالة توثيقه، اكتمال ملفه، وحالة مستنداته.
 *
 * يغذّي شاشة المراجعة (22) وشاشة «قيد المراجعة» (23) ولوحة التحكم (24).
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireProviderWorkspace(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.READ, 'provider-profile');

  return ok(await getMyProviderProfile(user.id));
});

/**
 * PATCH /api/v1/provider/profile
 * تعديل بيانات الخطوتين 1 و2 من أزرار «تعديل» في شاشة المراجعة (الصورة 22).
 *
 * المخطط لا يحوي `verification` ولا `isVerifiedBadge` ولا `isActive`، وهو
 * `.strict()` — فمحاولة تمريرها ترتد بـ400 قبل الوصول لأي منطق.
 */
export const PATCH = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireProviderWorkspace(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'provider-profile-update');

  const patch = await validateBody(request, updateProviderProfileSchema);

  return ok(await updateMyProviderProfile(user.id, patch));
});
