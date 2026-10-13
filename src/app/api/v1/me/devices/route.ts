import { z } from 'zod';
import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { registerDevice, unregisterDevice } from '@/server/services/push.service';

export const dynamic = 'force-dynamic';

const deviceSchema = z.object({ token: z.string().trim().min(20).max(4096) }).strict();

/**
 * POST /api/v1/me/devices — تطبيق «خدمات الفيوم» يسجّل رمز إشعارات جهازه
 * بعد موافقة المستخدم على إذن الإشعارات، وعند كل فتح (يجدّد `lastSeenAt`).
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'device-register');

  const { token } = await validateBody(request, deviceSchema);
  await registerDevice(user.id, token);
  return ok({ registered: true });
});

/** DELETE /api/v1/me/devices — قبل تسجيل الخروج: الجهاز يتوقف عن استلام إشعارات الحساب. */
export const DELETE = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'device-unregister');

  const { token } = await validateBody(request, deviceSchema);
  await unregisterDevice(user.id, token);
  return ok({ removed: true });
});
