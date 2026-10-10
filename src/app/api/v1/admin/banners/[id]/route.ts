import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams } from '@/server/middleware/with-validation';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { bannerIdParamSchema, updateBannerSchema } from '@/shared/schemas/banner.schema';
import { deleteBanner, updateBanner } from '@/server/services/banner.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function actorOf(request: Request, adminId: string) {
  return {
    id: adminId,
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  };
}

/** PATCH /api/v1/admin/banners/:id — تعديل بانر (بما فيه الصورة والتفعيل). */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-banner-update');

  const { id } = validateParams(await context.params, bannerIdParamSchema);
  const input = await validateBody(request, updateBannerSchema);

  return ok(await updateBanner(actorOf(request, admin.id), id, input));
});

/** DELETE /api/v1/admin/banners/:id — حذف بانر نهائيًا. */
export const DELETE = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-banner-delete');

  const { id } = validateParams(await context.params, bannerIdParamSchema);
  await deleteBanner(actorOf(request, admin.id), id);

  return ok({ deleted: true });
});
