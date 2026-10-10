import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { listPublicBanners } from '@/server/services/banner.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/banners — بانرات الرئيسية المفعّلة بترتيب الإدارة. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'banners');

  const items = await listPublicBanners();
  return ok(items, { total: items.length });
});
