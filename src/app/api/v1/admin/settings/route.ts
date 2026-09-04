import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { upsertSettingSchema } from '@/shared/schemas/admin.schema';
import { listSettings, upsertSetting } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/settings — كل الإعدادات العامة. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-settings');
  await requireRole(request, 'ADMIN');

  const items = await listSettings();
  return ok(items, { total: items.length });
});

/** POST /api/v1/admin/settings — إنشاء/تعديل إعداد (upsert بالمفتاح). */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-settings-write');

  const input = await validateBody(request, upsertSettingSchema);
  const result = await upsertSetting(
    {
      id: admin.id,
      ip: getClientIdentifier(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
    input
  );

  return ok(result);
});
