import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateParams } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { ok } from '@/server/lib/api-response';
import { professionIdParamSchema } from '@/shared/schemas/catalog.schema';
import { getProfessionDocumentRequirements } from '@/server/services/catalog.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/professions/:id/document-requirements
 *
 * المصدر الوحيد الذي تُبنى منه شاشة المستندات (3/4 — الصورة 21).
 * عدد البطاقات وتسمياتها وترتيبها وحالة الإلزام كلها تأتي من هنا،
 * ولا توجد أي قائمة ثابتة في الواجهة.
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  enforceRateLimit(request, RATE_LIMITS.READ, 'doc-requirements');

  const { id } = validateParams(await context.params, professionIdParamSchema);
  const result = await getProfessionDocumentRequirements(id);

  return ok(result, { total: result.requirements.length });
});
