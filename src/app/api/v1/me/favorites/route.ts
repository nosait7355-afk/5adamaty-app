import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { createFavoriteSchema } from '@/shared/schemas/account.schema';
import { listFavorites, toggleFavoriteEntry } from '@/server/services/account.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/me/favorites — المفضلة (عدّاد «المفضلة 12» في الصورة 16).
 *
 * تمرّ بمستودع الاكتشاف، فيسري عليها **حارس الظهور** نفسه: مزوّد فقد
 * اعتماده يختفي من المفضلة كما يختفي من البحث.
 */
export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.READ, 'favorites');

  return ok(await listFavorites(user));
});

/** POST /api/v1/me/favorites — تبديل (إضافة/إزالة) بزر ♡ واحد. */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'favorite-toggle');

  const input = await validateBody(request, createFavoriteSchema);

  return ok(await toggleFavoriteEntry(user, input));
});
