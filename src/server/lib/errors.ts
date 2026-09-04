/**
 * أخطاء التطبيق الموحّدة.
 *
 * كل خطأ يحمل: رمزًا ثابتًا للآلة، ورسالة **عربية** للمستخدم، ورسالة تقنية
 * اختيارية للسجل لا تصل للعميل أبدًا.
 */

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  UNPROCESSABLE: 'UNPROCESSABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface FieldErrors {
  [field: string]: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  /** رسالة عربية تُعرض للمستخدم. */
  readonly userMessage: string;
  readonly fields?: FieldErrors;
  /** true = خطأ متوقع في منطق العمل، false = عطل غير متوقع. */
  readonly isOperational: boolean;

  constructor(params: {
    code: ErrorCode;
    httpStatus: number;
    userMessage: string;
    /** تفاصيل تقنية للسجل فقط — لا تصل للعميل. */
    logMessage?: string;
    fields?: FieldErrors;
    cause?: unknown;
  }) {
    super(params.logMessage ?? params.userMessage, { cause: params.cause });
    this.name = 'AppError';
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.userMessage = params.userMessage;
    if (params.fields) this.fields = params.fields;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }
}

/* ---- مُنشئات مختصرة ---- */

export const badRequest = (userMessage: string, fields?: FieldErrors) =>
  new AppError({
    code: ERROR_CODES.VALIDATION_ERROR,
    httpStatus: 400,
    userMessage,
    ...(fields ? { fields } : {}),
  });

export const unauthorized = (userMessage = 'يجب تسجيل الدخول للمتابعة.') =>
  new AppError({ code: ERROR_CODES.UNAUTHORIZED, httpStatus: 401, userMessage });

export const forbidden = (userMessage = 'ليس لديك صلاحية لتنفيذ هذا الإجراء.') =>
  new AppError({ code: ERROR_CODES.FORBIDDEN, httpStatus: 403, userMessage });

/**
 * 404 يُستخدم أيضًا لمنع IDOR: عند محاولة الوصول لمورد يملكه غيرك نُرجع
 * «غير موجود» لا «ممنوع»، حتى لا نكشف وجود المورد (ARCHITECTURE §7).
 */
export const notFound = (userMessage = 'العنصر المطلوب غير موجود.') =>
  new AppError({ code: ERROR_CODES.NOT_FOUND, httpStatus: 404, userMessage });

export const conflict = (userMessage: string) =>
  new AppError({ code: ERROR_CODES.CONFLICT, httpStatus: 409, userMessage });

export const invalidTransition = (userMessage = 'لا يمكن تنفيذ هذا التغيير على حالة الطلب الحالية.') =>
  new AppError({ code: ERROR_CODES.INVALID_TRANSITION, httpStatus: 409, userMessage });

export const unprocessable = (userMessage: string, fields?: FieldErrors) =>
  new AppError({
    code: ERROR_CODES.UNPROCESSABLE,
    httpStatus: 422,
    userMessage,
    ...(fields ? { fields } : {}),
  });

export const rateLimited = (userMessage = 'محاولات كثيرة. برجاء المحاولة بعد قليل.') =>
  new AppError({ code: ERROR_CODES.RATE_LIMITED, httpStatus: 429, userMessage });

export const internalError = (logMessage: string, cause?: unknown) =>
  new AppError({
    code: ERROR_CODES.INTERNAL_ERROR,
    httpStatus: 500,
    userMessage: 'حدث خطأ غير متوقع. برجاء المحاولة مرة أخرى.',
    logMessage,
    cause,
  });

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
