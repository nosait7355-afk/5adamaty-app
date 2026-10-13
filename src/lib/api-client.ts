import type { ApiFailure, ApiMeta, ApiResponse } from '@/server/lib/api-response';
import type { ErrorCode, FieldErrors } from '@/server/lib/errors';

/**
 * كيف يصل العميل للـAPI ويصادق.
 *
 * الافتراضي هو الموقع: نفس المصدر، وكوكيز httpOnly يديرها المتصفح.
 * تطبيق «خدمات الفيوم» (`mobile/`) يستبدله عند الإقلاع بـ`setApiTransport`:
 * عنوان الخادم كاملًا، و`Authorization: Bearer`، وتوكن تحديث من التخزين
 * المشفّر — دون أن تعرف الصفحات والاستعلامات أي فرق.
 */
export interface ApiTransport {
  /** `/api/v1` للموقع، أو `https://…/api/v1` للتطبيق. */
  baseUrl: string;
  credentials: RequestCredentials;
  /** رؤوس وجسم إضافيان قبل كل طلب (التوكن، توكن التحديث للخروج والتجديد). */
  prepare?(
    path: string,
    request: { method: string; headers: Record<string, string>; body: unknown }
  ): Promise<{ headers: Record<string, string>; body: unknown }>;
  /** بيانات كل رد ناجح — يلتقط منها `session` ويعيدها بدونه. */
  receive?(path: string, method: string, data: unknown): Promise<unknown>;
  /** تعذّر تجديد الجلسة: انتهت فعلًا. */
  onSessionExpired?(): Promise<void>;
}

const WEB_TRANSPORT: ApiTransport = { baseUrl: '/api/v1', credentials: 'same-origin' };

let transport: ApiTransport = WEB_TRANSPORT;

export function setApiTransport(next: ApiTransport): void {
  transport = next;
}

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
 * مسارات لا تُعاد محاولتها بعد تحديث الجلسة — إما لأنها *هي* آلية
 * التحديث نفسها (لتفادي حلقة لا نهائية)، أو لأن 401 منها معناه فعلًا
 * «لست مسجّلًا دخولك» لا «جلستك انتهت».
 */
const NO_REFRESH_RETRY_PATHS = new Set([
  '/auth/refresh',
  '/auth/login',
  '/auth/register',
  '/auth/register-provider',
  '/auth/google',
  '/auth/logout',
]);

/** يمنع إطلاق أكثر من طلب تحديث جلسة واحد في آنٍ واحد. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = rawFetch('/auth/refresh', { method: 'POST' })
      .then(() => true)
      .catch(async (error: unknown) => {
        // رفض صريح من الخادم = الجلسة انتهت. انقطاع الشبكة ليس كذلك
        const rejected =
          error instanceof ApiClientError && (error.httpStatus === 401 || error.httpStatus === 403);
        if (rejected) await transport.onSessionExpired?.();
        return false;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * عميل الـAPI.
 *
 * الموقع: `credentials: 'same-origin'` ضروري لإرسال كوكيز الجلسة httpOnly.
 * لا يُخزَّن أي توكن في localStorage إطلاقًا (ARCHITECTURE §7) — والتطبيق
 * يحفظه في التخزين المشفّر عبر `ApiTransport`.
 *
 * توكن الوصول عمره 15 دقيقة فقط (`ACCESS_TOKEN_TTL_SECONDS`). بلا هذا،
 * أي طلب بعد 15 دقيقة من آخر تفاعل كان يعيد 401 ويُطرد المستخدم لشاشة
 * الدخول رغم أن توكن التحديث (30 يومًا) ما زال صالحًا. عند 401 نحاول
 * تحديث الجلسة مرة واحدة صامتًا ثم نعيد الطلب الأصلي.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  try {
    return await rawFetch<T>(path, options);
  } catch (error) {
    const canRetryAfterRefresh =
      error instanceof ApiClientError &&
      error.httpStatus === 401 &&
      !NO_REFRESH_RETRY_PATHS.has(path);

    if (!canRetryAfterRefresh) throw error;

    const refreshed = await refreshSession();
    if (!refreshed) throw error;

    return rawFetch<T>(path, options);
  }
}

async function rawFetch<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { body: rawBody, query, headers: rawHeaders, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();

  const prepared = transport.prepare
    ? await transport.prepare(path, {
        method,
        headers: Object.fromEntries(new Headers(rawHeaders).entries()),
        body: rawBody,
      })
    : { headers: rawHeaders, body: rawBody };
  const { body, headers } = prepared;

  const url = new URL(`${transport.baseUrl}${path}`, getOrigin());
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
      credentials: transport.credentials,
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

  const data = transport.receive
    ? ((await transport.receive(path, method, payload.data)) as T)
    : payload.data;
  return { data, ...(payload.meta ? { meta: payload.meta } : {}) };
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

function getOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.APP_URL ?? 'http://localhost:3000';
}
