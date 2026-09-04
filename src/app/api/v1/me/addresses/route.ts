import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { created, ok } from '@/server/lib/api-response';
import { createAddressSchema } from '@/shared/schemas/account.schema';
import { addAddress, listAddresses } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/me/addresses — عناويني (الصورة 17).
 * عناوين **نصية بحتة**: لا إحداثيات ولا اختيار من خريطة (ARCHITECTURE §0.2).
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.READ, 'addresses');

  return ok(await listAddresses(user));
});

/** POST /api/v1/me/addresses — «+ إضافة عنوان جديد». */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'address-create');

  const input = await validateBody(request, createAddressSchema);

  return created(await addAddress(user, input));
});
