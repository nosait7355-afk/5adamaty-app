import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody } from '@/server/middleware/with-validation';
import {
  enforceRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/server/middleware/with-rate-limit';
import { requireRole } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { ok } from '@/server/lib/api-response';
import { broadcastNotificationSchema } from '@/shared/schemas/admin.schema';
import { broadcastNotification } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/admin/notifications/broadcast
 * إشعار عام لكل المستخدمين النشطين أو فئة منهم — نوعه `PROMOTION` أو
 * `SYSTEM` فقط. حد أقصى 5000 مستلم لكل بث (ARCHITECTURE — أداء).
 */
export const POST = withErrorHandler(async (request) => {
  assertSameOrigin(request);
  const admin = await requireRole(request, 'ADMIN');
  enforceRateLimit(request, RATE_LIMITS.BROADCAST, 'admin-broadcast');

  const input = await validateBody(request, broadcastNotificationSchema);
  const result = await broadcastNotification(
    {
      id: admin.id,
      ip: getClientIdentifier(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
    input
  );

  return ok(result);
});
