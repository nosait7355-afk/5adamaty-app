import type { ApiTransport } from '@/lib/api-client';
import type { NativeSession } from '@/server/lib/session-transport';
import { NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE } from '@/shared/constants/native-app';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './token-vault';

/**
 * كيف يكلّم التطبيق الـAPI — يُركَّب في `api-client` عند الإقلاع.
 *
 * عقد الخادم (`src/server/lib/session-transport.ts`):
 * - رأس `x-client: native-app` في كل طلب.
 * - توكن الوصول في `Authorization: Bearer`.
 * - توكن التحديث في جسم `/auth/refresh` و`/auth/logout`.
 * - الردود التي تصدر جلسة تحمل `session` — نحفظها ونزيلها من البيانات
 *   قبل أن تصل للصفحات وذاكرة React Query.
 */

const REFRESH_TOKEN_PATHS = new Set(['/auth/refresh', '/auth/logout']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNativeSession(value: unknown): value is NativeSession {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    typeof value.refreshToken === 'string' &&
    typeof value.accessTokenExpiresIn === 'number'
  );
}

/** المسار بلا استعلام: `/auth/logout?all=true` ← `/auth/logout`. */
function bare(path: string): string {
  return path.split('?')[0] ?? path;
}

export function createNativeTransport(apiOrigin: string): ApiTransport {
  return {
    baseUrl: `${apiOrigin}/api/v1`,
    // لا كوكيز إطلاقًا — المصادقة كلها بالرأس
    credentials: 'omit',

    async prepare(path, { headers, body }) {
      const nextHeaders: Record<string, string> = {
        ...headers,
        [NATIVE_CLIENT_HEADER]: NATIVE_CLIENT_VALUE,
      };
      const accessToken = getAccessToken();
      if (accessToken) nextHeaders.Authorization = `Bearer ${accessToken}`;

      if (!REFRESH_TOKEN_PATHS.has(bare(path))) return { headers: nextHeaders, body };

      const refreshToken = await getRefreshToken();
      // الخروج يمسح الجهاز قبل الإرسال: لو فشل الطلب (لا إنترنت) لا يعود
      // المستخدم مسجّلًا عند الفتح التالي. الخادم يُبطل التوكن حين يصله.
      if (bare(path) === '/auth/logout') await clearSession();
      return {
        headers: nextHeaders,
        body: refreshToken ? { ...(isRecord(body) ? body : {}), refreshToken } : body,
      };
    },

    async receive(path, method, data) {
      const route = bare(path);

      // حذف الحساب: الخادم حذف الجلسات، فلا يبقى منها شيء على الجهاز
      if (route === '/me/account' && method === 'DELETE') {
        await clearSession();
        return data;
      }

      if (isRecord(data) && isNativeSession(data.session)) {
        const { session, ...rest } = data;
        await saveSession(session);
        return rest;
      }
      return data;
    },

    async onSessionExpired() {
      await clearSession();
    },
  };
}
