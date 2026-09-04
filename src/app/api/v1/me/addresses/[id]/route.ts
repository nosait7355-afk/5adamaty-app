import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { addressIdParamSchema, updateAddressSchema } from '@/shared/schemas/account.schema';
import { editAddress, removeAddress } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/v1/me/addresses/:id — «تعديل». عنوان مستخدم آخر يعيد 404. */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'address-update');

  const { id } = validateParams(await context.params, addressIdParamSchema);
  const patch = await validateBody(request, updateAddressSchema);

  return ok(await editAddress(user, id, patch));
});

/** DELETE /api/v1/me/addresses/:id — «حذف». */
export const DELETE = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'address-delete');

  const { id } = validateParams(await context.params, addressIdParamSchema);
  await removeAddress(user, id);

  return ok({ deleted: true });
});
