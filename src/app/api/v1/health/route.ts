import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { ok } from '@/server/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/health
 * فحص حياة الخدمة. يتحقق من صحة إعداد البيئة ضمنيًا عبر استيراد getEnv في Phase 2.
 */
export const GET = withErrorHandler(async () => {
  return ok({
    status: 'ok',
    service: 'khadamaty-elfayoum',
    phase: 1,
    timestamp: new Date().toISOString(),
  });
});
