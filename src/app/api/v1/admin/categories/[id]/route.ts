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
import { categoryIdParamSchema, updateCategorySchema } from '@/shared/schemas/admin.schema';
import { updateCategory } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/v1/admin/categories/:id — تعديل تصنيف (بما فيه تفعيل/تعطيل). */
export const PATCH = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'admin-category-update');

  const { id } = validateParams(await context.params, categoryIdParamSchema);
  const input = await validateBody(request, updateCategorySchema);

  const result = await updateCategory(
    {
      id: admin.id,
      ip: getClientIdentifier(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
    id,
    input
  );

  return ok(result);
});
