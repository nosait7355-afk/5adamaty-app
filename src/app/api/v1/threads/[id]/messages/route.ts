import { withErrorHandler } from '@/server/middleware/with-error-handler';
import { validateBody, validateParams, validateQuery } from '@/server/middleware/with-validation';
import { enforceRateLimit, RATE_LIMITS } from '@/server/middleware/with-rate-limit';
import { requireAuth } from '@/server/middleware/with-auth';
import { assertSameOrigin } from '@/server/lib/csrf';
import { created, ok } from '@/server/lib/api-response';
import {
  listThreadsQuerySchema,
  sendMessageSchema,
  threadIdParamSchema,
} from '@/shared/schemas/account.schema';
import { getThreadMessages, sendMessage } from '@/server/services/messaging.service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/threads/:id/messages
 * رسائل المحادثة — غير المشارك يحصل على 404 لا 403.
 * فتح المحادثة يعلّم رسائلها الواردة مقروءة.
 */
export const GET = withErrorHandler<RouteContext>(async (request, context) => {
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.READ, 'thread-messages');

  const { id } = validateParams(await context.params, threadIdParamSchema);
  const query = validateQuery(request, listThreadsQuerySchema);
  const result = await getThreadMessages(user, id, query);

  return ok(
    { thread: result.thread, items: result.items },
    { page: result.page, limit: result.limit, total: result.total, hasMore: result.hasMore }
  );
});

/** POST /api/v1/threads/:id/messages — إرسال رسالة. */
export const POST = withErrorHandler<RouteContext>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireAuth(request);
  enforceRateLimit(request, RATE_LIMITS.WRITE, 'send-message');

  const { id } = validateParams(await context.params, threadIdParamSchema);
  const input = await validateBody(request, sendMessageSchema);

  return created(await sendMessage(user, id, input));
});
