import { describe, expect, it } from 'vitest';
import { assertNoOperatorKeys, validateQuery } from '@/server/middleware/with-validation';
import { checkRateLimit, resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import {
  egyptPhoneSchema,
  emailSchema,
  passwordSchema,
  paginationSchema,
  textAddressSchema,
  objectIdSchema,
  safeString,
} from '@/shared/schemas/common.schema';
import { discoveryQuerySchema, listCategoriesQuerySchema } from '@/shared/schemas/catalog.schema';
import { requireRole, assertOwnership, type SessionUser } from '@/server/middleware/with-auth';
import {
  buildDocumentRequirements,
  validateRequirementsConsistency,
} from '@/shared/constants/documents';

describe('حماية حقن NoSQL', () => {
  it('يرفض المفاتيح التي تبدأ بـ$', () => {
    expect(() => assertNoOperatorKeys({ email: { $ne: null } })).toThrow(/غير مسموح/);
    expect(() => assertNoOperatorKeys({ $where: 'this.a==1' })).toThrow(/غير مسموح/);
  });

  it('يرفض المفاتيح التي تحتوي نقطة', () => {
    expect(() => assertNoOperatorKeys({ 'user.role': 'ADMIN' })).toThrow(/غير مسموح/);
  });

  it('يرفض تلويث الـprototype', () => {
    expect(() => assertNoOperatorKeys({ __proto__: { admin: true } })).not.toThrow();
    expect(() => assertNoOperatorKeys(JSON.parse('{"__proto__":{"a":1}}'))).toThrow(/غير مسموح/);
    expect(() => assertNoOperatorKeys({ constructor: {} })).toThrow(/غير مسموح/);
  });

  it('يفحص المستويات المتداخلة والمصفوفات', () => {
    expect(() => assertNoOperatorKeys({ a: { b: { $gt: 1 } } })).toThrow();
    expect(() => assertNoOperatorKeys({ list: [{ $ne: 1 }] })).toThrow();
  });

  it('يقبل البيانات النظيفة', () => {
    expect(() =>
      assertNoOperatorKeys({ name: 'أحمد', area: 'حي الجامعة', nested: { ok: [1, 2] } })
    ).not.toThrow();
  });

  it('يرفض العمق المفرط (حماية من DoS)', () => {
    let deep: Record<string, unknown> = { end: true };
    for (let i = 0; i < 15; i += 1) deep = { next: deep };
    expect(() => assertNoOperatorKeys(deep)).toThrow(/معقّدة/);
  });
});

describe('المخططات الصارمة (strict) — منع mass-assignment', () => {
  it('يرفض أي مفتاح غير معرّف', () => {
    const request = new Request('http://x/api?includeInactive=false&role=ADMIN');
    expect(() => validateQuery(request, listCategoriesQuerySchema)).toThrow();
  });

  it('يقبل المفاتيح المعرّفة فقط', () => {
    const request = new Request('http://x/api?includeInactive=true');
    expect(validateQuery(request, listCategoriesQuerySchema)).toEqual({ includeInactive: true });
  });
});

describe('egyptPhoneSchema', () => {
  it('يطبّع كل الصيغ المصرية إلى E.164', () => {
    for (const input of ['01012345678', '+201012345678', '201012345678', '010 1234 5678']) {
      expect(egyptPhoneSchema.parse(input)).toBe('+201012345678');
    }
  });

  it('يرفض الأرقام غير المصرية', () => {
    expect(() => egyptPhoneSchema.parse('+12025551234')).toThrow();
    expect(() => egyptPhoneSchema.parse('02012345678')).toThrow();
    expect(() => egyptPhoneSchema.parse('123')).toThrow();
  });
});

describe('emailSchema', () => {
  it('يقبل أي بريد صحيح بامتداد حروف', () => {
    for (const input of ['name@gmail.com', 'a.b+c@yahoo.com', 'user@company.com.eg', 'x@mail-server.org']) {
      expect(emailSchema.safeParse(input).success, input).toBe(true);
    }
  });

  it('يطبّع إلى أحرف صغيرة بلا مسافات', () => {
    expect(emailSchema.parse('  Name@Gmail.COM ')).toBe('name@gmail.com');
  });

  it('يرفض مقاطع دومين رقمية بحتة وامتدادات غير حرفية', () => {
    for (const input of ['name@gmail.37.com', 'name@37.com', 'name@gmail.c0m', 'name@gmail.1', 'gmail.37.com', 'name@gmail']) {
      expect(emailSchema.safeParse(input).success, input).toBe(false);
    }
  });
});

describe('passwordSchema', () => {
  it('يفرض 8 أحرف + حرف + رقم', () => {
    expect(() => passwordSchema.parse('Ahmed123')).not.toThrow();
    expect(() => passwordSchema.parse('كلمةسر123')).not.toThrow();
    expect(() => passwordSchema.parse('short1')).toThrow(/8 أحرف/);
    expect(() => passwordSchema.parse('12345678')).toThrow(/حرفًا/);
    expect(() => passwordSchema.parse('abcdefgh')).toThrow(/رقمًا/);
  });

  it('يرفض كلمة المرور المفرطة الطول (حماية من DoS على التجزئة)', () => {
    expect(() => passwordSchema.parse(`a1${'x'.repeat(200)}`)).toThrow(/طويلة/);
  });
});

describe('textAddressSchema — نصي بحت', () => {
  it('يقبل عنوانًا من مناطق الفيوم', () => {
    const parsed = textAddressSchema.parse({
      city: 'الفيوم',
      area: 'حي الجامعة',
      line: 'شارع أحمد شوقي',
    });
    expect(parsed.governorate).toBe('الفيوم');
  });

  it('يرفض منطقة خارج القائمة', () => {
    expect(() =>
      textAddressSchema.parse({ city: 'الفيوم', area: 'مدينة نصر', line: 'شارع' })
    ).toThrow(/المنطقة/);
  });

  it('يرفض أي حقل إحداثيات', () => {
    expect(() =>
      textAddressSchema.parse({
        city: 'الفيوم',
        area: 'حي الجامعة',
        line: 'شارع',
        lat: 29.3,
        lng: 30.8,
      })
    ).toThrow();
  });
});

describe('paginationSchema', () => {
  it('يطبّق القيم الافتراضية', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('يحدّ الحجم الأقصى بـ50 (منع استنزاف الخادم)', () => {
    expect(() => paginationSchema.parse({ limit: 5000 })).toThrow();
  });

  it('يرفض الصفحات غير الموجبة', () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
    expect(() => paginationSchema.parse({ page: -1 })).toThrow();
  });
});

describe('discoveryQuerySchema', () => {
  it('يرفض أي مفتاح سعر — التسعير أُزيل من المنصة', () => {
    expect(() => discoveryQuerySchema.parse({ priceMin: 100 })).toThrow();
    expect(() => discoveryQuerySchema.parse({ priceMax: 500 })).toThrow();
  });

  it('يرفض منطقة غير موجودة في الفيوم', () => {
    expect(() => discoveryQuerySchema.parse({ area: 'الإسكندرية' })).toThrow(/المنطقة/);
  });

  it('الترتيب الافتراضي بالتقييم', () => {
    expect(discoveryQuerySchema.parse({}).sort).toBe('rating');
  });
});

describe('safeString / objectIdSchema', () => {
  it('يرفض النصوص التي تبدأ بـ$', () => {
    expect(() => safeString(50).parse('$ne')).toThrow(/غير مسموح/);
  });

  it('يفرض الحد الأقصى للطول', () => {
    expect(() => safeString(5).parse('نص طويل جدا هنا')).toThrow();
  });

  it('يتحقق من صحة ObjectId', () => {
    expect(() => objectIdSchema.parse('507f1f77bcf86cd799439011')).not.toThrow();
    expect(() => objectIdSchema.parse('abc')).toThrow();
    expect(() => objectIdSchema.parse("507f1f77bcf86cd79943901'")).toThrow();
  });
});

describe('تحديد المعدّل', () => {
  it('يسمح ضمن الحد ويمنع بعده', () => {
    resetRateLimitStore();
    const rule = { limit: 3, windowMs: 60_000 };

    expect(checkRateLimit('ip-a', rule).allowed).toBe(true);
    expect(checkRateLimit('ip-a', rule).allowed).toBe(true);
    expect(checkRateLimit('ip-a', rule).allowed).toBe(true);
    expect(checkRateLimit('ip-a', rule).allowed).toBe(false);
  });

  it('يعزل العملاء عن بعضهم', () => {
    resetRateLimitStore();
    const rule = { limit: 1, windowMs: 60_000 };

    expect(checkRateLimit('ip-b', rule).allowed).toBe(true);
    expect(checkRateLimit('ip-b', rule).allowed).toBe(false);
    // عميل آخر لا يتأثر
    expect(checkRateLimit('ip-c', rule).allowed).toBe(true);
  });

  it('يعيد الضبط بعد انتهاء النافذة', async () => {
    resetRateLimitStore();
    const rule = { limit: 1, windowMs: 30 };

    expect(checkRateLimit('ip-d', rule).allowed).toBe(true);
    expect(checkRateLimit('ip-d', rule).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(checkRateLimit('ip-d', rule).allowed).toBe(true);
  });
});

describe('حُرّاس التفويض', () => {
  const admin: SessionUser = { id: 'a1', role: 'ADMIN', status: 'ACTIVE' };
  const customer: SessionUser = { id: 'c1', role: 'CUSTOMER', status: 'ACTIVE' };

  it('requireRole يرفض بلا جلسة (السلوك الآمن قبل Phase 3)', async () => {
    await expect(requireRole(new Request('http://x'), 'ADMIN')).rejects.toThrow();
  });

  it('assertOwnership يمرّر المالك', () => {
    expect(() => assertOwnership(customer, ['c1'], new Error('404'))).not.toThrow();
  });

  it('assertOwnership يرمي 404 لغير المالك — منع IDOR', () => {
    const notFoundError = new Error('العنصر المطلوب غير موجود.');
    expect(() => assertOwnership(customer, ['other-user'], notFoundError)).toThrow(
      /غير موجود/
    );
  });

  it('assertOwnership يتجاوز الفحص للإدارة', () => {
    expect(() => assertOwnership(admin, ['someone-else'], new Error('404'))).not.toThrow();
  });

  it('assertOwnership يتجاهل المعرّفات الفارغة', () => {
    expect(() => assertOwnership(customer, [null, undefined, 'c1'], new Error('404'))).not.toThrow();
    expect(() => assertOwnership(customer, [null, undefined], new Error('404'))).toThrow();
  });
});

describe('قاعدة اتساق المستندات', () => {
  it('القالب الحرفي متسق', () => {
    const reqs = buildDocumentRequirements({ requiresQualification: false, requiresLicense: false });
    expect(
      validateRequirementsConsistency(reqs, { requiresQualification: false, requiresLicense: false })
    ).toEqual([]);
  });

  it('القالب المنظَّم متسق', () => {
    const reqs = buildDocumentRequirements({ requiresQualification: true, requiresLicense: true });
    expect(
      validateRequirementsConsistency(reqs, { requiresQualification: true, requiresLicense: true })
    ).toEqual([]);
  });

  it('لا يرصد شيئًا على المؤهل أو الترخيص — صارا اختياريين دائمًا', () => {
    const reqs = buildDocumentRequirements({});
    expect(
      validateRequirementsConsistency(reqs, {
        requiresQualification: false,
        requiresLicense: false,
      })
    ).toEqual([]);
    expect(
      validateRequirementsConsistency(reqs, { requiresQualification: true, requiresLicense: true })
    ).toEqual([]);
  });

  it('يرصد غياب بطاقة الرقم القومي', () => {
    const reqs = buildDocumentRequirements({}).filter((item) => item.key !== 'NATIONAL_ID');
    const violations = validateRequirementsConsistency(reqs);
    expect(violations.map((v) => v.key)).toContain('NATIONAL_ID');
  });

  it('يرصد بطاقة قومية اختيارية', () => {
    const reqs = buildDocumentRequirements({ requiresQualification: false, requiresLicense: false });
    const nid = reqs.find((r) => r.key === 'NATIONAL_ID');
    if (nid) nid.required = false;

    const violations = validateRequirementsConsistency(reqs, {
      requiresQualification: false,
      requiresLicense: false,
    });
    expect(violations.map((v) => v.key)).toContain('NATIONAL_ID');
  });

  it('لا يُنشئ إثبات عنوان تلقائيًا بعد الآن', () => {
    const reqs = buildDocumentRequirements({ requiresQualification: false, requiresLicense: false });
    expect(reqs.find((r) => r.key === 'ADDRESS_PROOF')).toBeUndefined();
  });
});
