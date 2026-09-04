import type { ApiFailure, ApiMeta, ApiResponse } from '@/server/lib/api-response';
import type { ErrorCode, FieldErrors } from '@/server/lib/errors';

const BASE_URL = '/api/v1';

/** خطأ صادر عن الـAPI بشكل الاستجابة الموحّد. */
export class ApiClientError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly httpStatus: number;
  readonly fields?: FieldErrors;

  constructor(params: {
    code: ErrorCode | 'NETWORK_ERROR';
    message: string;
    httpStatus: number;
    fields?: FieldErrors;
  }) {
    super(params.message);
    this.name = 'ApiClientError';
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    if (params.fields) this.fields = params.fields;
  }
}

export interface ApiResult<T> {
  data: T;
  meta?: ApiMeta;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** معاملات الاستعلام — تُبنى بأمان وتتجاهل القيم الفارغة. */
  query?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * عميل الـAPI.
 *
 * `credentials: 'same-origin'` ضروري لإرسال كوكيز الجلسة httpOnly.
 * لا يُخزَّن أي توكن في localStorage إطلاقًا (ARCHITECTURE §7).
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { body, query, headers, ...rest } = options;

  const url = new URL(`${BASE_URL}${path}`, getOrigin());
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...rest,
    });
  } catch {
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.',
      httpStatus: 0,
    });
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: 'استجابة غير صالحة من الخادم.',
      httpStatus: response.status,
    });
  }

  if (!response.ok || payload.success === false) {
    const failure = payload as ApiFailure;
    throw new ApiClientError({
      code: failure.error?.code ?? 'NETWORK_ERROR',
      message: failure.error?.message ?? 'حدث خطأ غير متوقع.',
      httpStatus: response.status,
      ...(failure.error?.fields ? { fields: failure.error.fields } : {}),
    });
  }

  return { data: payload.data, ...(payload.meta ? { meta: payload.meta } : {}) };
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

function getOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.APP_URL ?? 'http://localhost:3000';
}
