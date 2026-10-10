import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { created, ok } from '@/server/lib/api-response';
import { createBannerSchema } from '@/shared/schemas/banner.schema';
import { createBanner, listBannersForAdmin } from '@/server/services/banner.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/banners — كل البانرات بما فيها المعطّلة. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-banners');
  await requireRole(request, 'ADMIN');

  const items = await listBannersForAdmin();
  return ok(items, { total: items.length });
});

/** POST /api/v1/admin/banners — إضافة بانر. */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-banners');

  const input = await validateBody(request, createBannerSchema);
  const result = await createBanner(
    {
      id: admin.id,
      ip: getClientIdentifier(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
    input
  );

  return created(result);
});
