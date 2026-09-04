import { rateLimited } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';

/**
 * تحديد معدّل الطلبات.
 *
 * التنفيذ الحالي في الذاكرة — يكفي للتطوير وللنشر على خادم واحد.
 * في الإنتاج متعدد النسخ يُستبدل المخزن بـRedis (Phase 10) بلا تغيير
 * في واجهة الاستدعاء.
 */

export const RATE_LIMITS = {
  /** المصادقة: 5 محاولات/دقيقة — حماية من التخمين (ARCHITECTURE §7). */
  AUTH: { limit: 5, windowMs: 60_000 },
  /** عمليات الكتابة: 30/دقيقة. */
  WRITE: { limit: 30, windowMs: 60_000 },
  /** القراءة: 120/دقيقة. */
  READ: { limit: 120, windowMs: 60_000 },
  /** توقيع رفع الملفات: 20/دقيقة. */
  UPLOAD: { limit: 20, windowMs: 60_000 },
  /**
   * البحث النصي: 30/دقيقة — أقلّ من القراءة العادية لأن كل استدعاء يمسّ
   * فهرسًا نصيًا، وحقل البحث يُستدعى بـdebounce مع كل كتابة.
   */
  SEARCH: { limit: 30, windowMs: 60_000 },
  /**
   * البث العام للإشعارات: 5/ساعة — عملية جماعية حسّاسة تصل لآلاف
   * المستخدمين دفعة واحدة (Phase 10 — لوحة الإدارة)، فحدّها أشد بكثير
   * من أي كتابة عادية.
   */
  BROADCAST: { limit: 5, windowMs: 60 * 60_000 },
} as const;

export type RateLimitRule = { limit: number; windowMs: number };

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

/** تنظيف دوري للنوافذ المنتهية حتى لا تتضخم الذاكرة. */
let lastSweep = Date.now();
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(identifier: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = store.get(identifier);

  if (!bucket || bucket.resetAt <= now) {
    store.set(identifier, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, resetAt: now + rule.windowMs };
  }

  bucket.count += 1;
  const allowed = bucket.count <= rule.limit;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * يستخرج معرّف العميل من رؤوس الوكيل.
 * ملاحظة أمنية: هذه الرؤوس قابلة للتزوير، لذا تُستخدم لتحديد المعدّل فقط
 * ولا يُبنى عليها أي قرار تفويض.
 */
export function getClientIdentifier(request: Request, suffix = ''): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
  return `${ip}${suffix ? `:${suffix}` : ''}`;
}

/** يفرض الحدّ ويرمي 429 عند التجاوز. */
export function enforceRateLimit(request: Request, rule: RateLimitRule, scope: string): void {
  const identifier = getClientIdentifier(request, scope);
  const result = checkRateLimit(identifier, rule);

  if (!result.allowed) {
    logger.warn('تم تجاوز حد المعدّل', {
      scope,
      path: new URL(request.url).pathname,
    });
    throw rateLimited();
  }
}

/** للاختبارات فقط. */
export function resetRateLimitStore(): void {
  store.clear();
  lastSweep = Date.now();
}
