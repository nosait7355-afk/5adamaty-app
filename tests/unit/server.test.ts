import { describe, expect, it } from 'vitest';
import { redact } from '@/server/lib/logger';
import {
  AppError,
  ERROR_CODES,
  badRequest,
  forbidden,
  isAppError,
  notFound,
  unauthorized,
} from '@/server/lib/errors';
import { PAYMENT_METHOD } from '@/shared/constants/order-status';
import {
  ALL_FAYOUM_AREAS,
  isValidCoverageArea,
  toCoverageCities,
  FAYOUM_AREAS,
  isValidArea,
  isValidCity,
} from '@/shared/constants/fayoum-areas';

describe('logger.redact', () => {
  it('يمسح كلمات المرور والتوكنات تمامًا', () => {
    const result = redact({
      password: 'MySecret123',
      passwordHash: '$argon2id$abc',
      refreshToken: 'eyJhbGci',
      authorization: 'Bearer xyz',
    }) as Record<string, unknown>;

    expect(result.password).toBe('[REDACTED]');
    expect(result.passwordHash).toBe('[REDACTED]');
    expect(result.refreshToken).toBe('[REDACTED]');
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('يقنّع الهاتف والبريد جزئيًا بدل حذفهما', () => {
    const result = redact({ phone: '+201012345678', email: 'ahmed@example.com' }) as Record<
      string,
      unknown
    >;

    expect(result.phone).toBe('+20***78');
    expect(result.email).toBe('ahm***om');
    expect(result.phone).not.toContain('1012345');
  });

  it('ينقّح الكائنات المتداخلة', () => {
    const result = redact({ user: { name: 'أحمد', password: 'x' } }) as {
      user: Record<string, unknown>;
    };
    expect(result.user.name).toBe('أحمد');
    expect(result.user.password).toBe('[REDACTED]');
  });

  it('ينقّح داخل المصفوفات', () => {
    const result = redact([{ token: 'abc' }]) as Array<Record<string, unknown>>;
    expect(result[0]?.token).toBe('[REDACTED]');
  });

  it('يتوقف عند العمق الأقصى فلا يدخل في حلقة لا نهائية', () => {
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let i = 0; i < 20; i += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    expect(() => redact(deep)).not.toThrow();
  });
});

describe('AppError', () => {
  it('يفصل رسالة المستخدم العربية عن رسالة السجل التقنية', () => {
    const error = new AppError({
      code: ERROR_CODES.INTERNAL_ERROR,
      httpStatus: 500,
      userMessage: 'حدث خطأ غير متوقع.',
      logMessage: 'MongoServerError: connection refused at 10.0.0.1',
    });

    expect(error.userMessage).toBe('حدث خطأ غير متوقع.');
    expect(error.message).toContain('MongoServerError');
    expect(error.userMessage).not.toContain('MongoServerError');
  });

  it('يحمل الرموز والحالات الصحيحة', () => {
    expect(unauthorized().httpStatus).toBe(401);
    expect(forbidden().httpStatus).toBe(403);
    expect(notFound().httpStatus).toBe(404);
    expect(badRequest('خطأ').code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('يميّز أخطاء التطبيق عن غيرها', () => {
    expect(isAppError(notFound())).toBe(true);
    expect(isAppError(new Error('عادي'))).toBe(false);
  });

  it('يحمل أخطاء الحقول', () => {
    const error = badRequest('بيانات غير صحيحة', { phone: 'رقم غير صالح' });
    expect(error.fields).toEqual({ phone: 'رقم غير صالح' });
  });
});

/**
 * اختبارات القيود غير القابلة للتفاوض.
 * تفشل فورًا لو تسلّل دفع إلكتروني أو بُعد جغرافي إلى الثوابت.
 */
describe('القيود غير القابلة للتفاوض', () => {
  it('طريقة الدفع قيمة واحدة ثابتة خارج التطبيق', () => {
    expect(PAYMENT_METHOD).toBe('CASH_ON_DELIVERY_OFFLINE');
  });

  it('مناطق الفيوم بيانات نصية بحتة بلا أي إحداثيات', () => {
    for (const areas of Object.values(FAYOUM_AREAS)) {
      for (const area of areas) {
        expect(typeof area).toBe('string');
      }
    }
    // القائمة المسطّحة نصوص فقط — لا كائنات فيها lat/lng
    expect(ALL_FAYOUM_AREAS.every((a) => typeof a === 'string')).toBe(true);
  });

  it('يتحقق من صحة المنطقة والمدينة', () => {
    expect(isValidArea('حي الجامعة')).toBe(true);
    // التغطية مراكز فقط، والتحويل من الأحياء القديمة إلى مركزها بلا تكرار
    expect(isValidCoverageArea('الفيوم')).toBe(true);
    expect(isValidCoverageArea('حي الجامعة')).toBe(false);
    expect(toCoverageCities(['حي الجامعة', 'الحوّاتم', 'سنورس البلد', 'يوسف الصديق'])).toEqual([
      'الفيوم',
      'سنورس',
      'إبشواي',
    ]);
    expect(isValidArea('منطقة وهمية')).toBe(false);
    expect(isValidCity('سنورس')).toBe(true);
    expect(isValidCity('القاهرة')).toBe(false);
  });
});
