import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ERROR_CODES, isAppError, type FieldErrors } from '@/server/lib/errors';
import { fail } from '@/server/lib/api-response';
import { logger } from '@/server/lib/logger';
import { isProduction } from '@/server/lib/env';

type Handler<Ctx> = (request: Request, context: Ctx) => Promise<NextResponse> | NextResponse;

/**
 * الغلاف الخارجي لكل route handler.
 *
 * يضمن أمرين: (1) لا يتسرّب أي stack trace أو تفصيل داخلي للعميل في الإنتاج،
 * (2) كل خطأ يُسجَّل بـ requestId يمكن تتبّعه.
 */
export function withErrorHandler<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, context) => {
    const requestId = crypto.randomUUID();
    const started = Date.now();

    try {
      const response = await handler(request, context);
      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (error) {
      return handleError(error, {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        durationMs: Date.now() - started,
      });
    }
  };
}

function handleError(
  error: unknown,
  meta: { requestId: string; method: string; path: string; durationMs: number }
): NextResponse {
  // أخطاء التحقق من Zod → 400 مع أخطاء الحقول
  if (error instanceof ZodError) {
    const fields: FieldErrors = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    logger.warn('فشل التحقق من المدخلات', { ...meta, fields });
    const response = fail(
      ERROR_CODES.VALIDATION_ERROR,
      'البيانات المُدخلة غير صحيحة. برجاء مراجعة الحقول.',
      400,
      fields
    );
    response.headers.set('X-Request-Id', meta.requestId);
    return response;
  }

  // أخطاء منطق العمل المتوقعة
  if (isAppError(error)) {
    const level = error.httpStatus >= 500 ? 'error' : 'warn';
    logger[level](error.message, { ...meta, code: error.code, status: error.httpStatus });

    const response = fail(error.code, error.userMessage, error.httpStatus, error.fields);
    response.headers.set('X-Request-Id', meta.requestId);
    return response;
  }

  // أي شيء آخر = عطل غير متوقع. نسجّل التفاصيل ولا نُظهرها.
  logger.error('خطأ غير متوقع', {
    ...meta,
    error: error instanceof Error ? error : String(error),
  });

  const response = fail(
    ERROR_CODES.INTERNAL_ERROR,
    isProduction
      ? 'حدث خطأ غير متوقع. برجاء المحاولة مرة أخرى.'
      : `خطأ غير متوقع: ${error instanceof Error ? error.message : String(error)}`,
    500
  );
  response.headers.set('X-Request-Id', meta.requestId);
  return response;
}
