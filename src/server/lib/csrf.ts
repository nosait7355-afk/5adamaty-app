import { forbidden } from './errors';
import { getEnv, isProduction } from './env';
import { logger } from './logger';
import { NATIVE_APP_ORIGINS } from '@/shared/constants/native-app';

/**
 * حماية CSRF بفحص المصدر (ARCHITECTURE §7).
 *
 * `SameSite=Lax` وحدها تمنع أغلب هجمات CSRF، لكنها لا تغطي كل الحالات
 * (متصفحات قديمة، بعض سيناريوهات التنقّل). فحص `Origin` طبقة ثانية:
 * كل طلب يغيّر حالة يجب أن يأتي من نطاق معروف.
 *
 * التطبيق يعمل أيضًا داخل Capacitor على أندرويد، فمصادره مسموحة صراحةً.
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function allowedOrigins(): string[] {
  const env = getEnv();
  const origins: string[] = [env.APP_URL, ...NATIVE_APP_ORIGINS];

  if (!isProduction) {
    // 5173: واجهة تطبيق «خدمات الفيوم» في المتصفح (npm run mobile:dev)
    origins.push('http://localhost:3000', 'http://localhost:3100', 'http://127.0.0.1:3000', 'http://localhost:5173');
  }
  return origins;
}

/**
 * يرفض الطلبات المُغيِّرة القادمة من مصدر غير معروف.
 *
 * غياب `Origin` و`Referer` معًا مسموح: بعض عملاء غير المتصفح (وCapacitor
 * في حالات) لا يرسلونهما، والكوكي `SameSite=Lax` تحمي المتصفحات أصلًا.
 */
export function assertSameOrigin(request: Request): void {
  if (!MUTATING_METHODS.has(request.method)) return;

  const origin = request.headers.get('origin');
  if (!origin) {
    const referer = request.headers.get('referer');
    if (!referer) return;

    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins().includes(refererOrigin)) return;
    } catch {
      // referer تالف — نعامله كمصدر غير معروف
    }

    logger.warn('طلب مرفوض — referer غير معروف', {
      path: new URL(request.url).pathname,
    });
    throw forbidden('طلب غير مصرّح به.');
  }

  if (allowedOrigins().includes(origin)) return;

  logger.warn('طلب مرفوض — مصدر غير معروف', {
    origin,
    path: new URL(request.url).pathname,
  });
  throw forbidden('طلب غير مصرّح به.');
}
