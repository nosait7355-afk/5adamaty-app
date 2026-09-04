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
import { createCategorySchema } from '@/shared/schemas/admin.schema';
import { createCategory, listCategoriesForAdmin } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/categories — كل التصنيفات بما فيها المعطّلة. */
export const GET = withErrorHandler(async (request) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'admin-categories');
  await requireRole(request, 'ADMIN');

  const items = await listCategoriesForAdmin();
  return ok(items, { total: items.length });
});

/** POST /api/v1/admin/categories — إنشاء تصنيف جديد. */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-categories');

  const input = await validateBody(request, createCategorySchema);
  const result = await createCategory(
    {
      id: admin.id,
      ip: getClientIdentifier(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
    input
  );

  return created(result);
});
