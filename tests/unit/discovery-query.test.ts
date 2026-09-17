import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  buildPagination,
  buildProviderMatch,
  buildServiceMatch,
  buildSort,
  escapeRegex,
  PUBLIC_PROVIDER_MATCH,
} from '@/server/repositories/discovery.repository';
import {
  discoveryQuerySchema,
  searchQuerySchema,
  SORT_OPTIONS,
} from '@/shared/schemas/catalog.schema';

/**
 * اختبارات وحدة لبناء الاستعلام — بلا قاعدة بيانات.
 * الغرض: إثبات أن حارس الظهور لا يمكن إسقاطه بأي تركيبة فلاتر.
 */

const OID = '507f1f77bcf86cd799439011';
const OID_2 = '507f1f77bcf86cd799439012';

describe('buildProviderMatch', () => {
  it('يبدأ دائمًا بحارس الظهور حتى بلا فلاتر', () => {
    expect(buildProviderMatch({})).toEqual(PUBLIC_PROVIDER_MATCH);
  });

  it('لا يمكن لأي فلتر أن يلغي الحارس', () => {
    const match = buildProviderMatch({
      categoryId: OID,
      professionId: OID_2,
      area: 'الفيوم',
      minRating: 4.5,
      q: 'سباك',
    });

    expect(match.isActive).toBe(true);
    expect(match['verification.status']).toBe('APPROVED');
  });

  it('يحوّل المعرّفات النصية إلى ObjectId', () => {
    const match = buildProviderMatch({ categoryId: OID, professionId: OID_2 });
    expect(match.categoryId).toBeInstanceOf(Types.ObjectId);
    expect(String(match.categoryId)).toBe(OID);
    expect(String(match.professionId)).toBe(OID_2);
  });

  it('المنطقة مطابقة نصية على مصفوفة التغطية — لا إحداثيات ولا نصف قطر', () => {
    const match = buildProviderMatch({ area: 'سنورس' });
    expect(match.coverageAreas).toBe('سنورس');
    expect(JSON.stringify(match)).not.toMatch(/lat|lng|coordinates|radius|geo/i);
  });

  it('يضيف البحث النصي عند وجود q فقط', () => {
    expect(buildProviderMatch({}).$text).toBeUndefined();
    expect(buildProviderMatch({ q: 'كهربائي' }).$text).toEqual({ $search: 'كهربائي' });
  });

  it('لا يضيف مفاتيح للفلاتر غير الممرَّرة', () => {
    expect(Object.keys(buildProviderMatch({ minRating: 4 }))).toEqual([
      'isActive',
      'verification.status',
      'ratingAvg',
    ]);
  });
});

describe('buildServiceMatch', () => {
  it('يقصر النتائج على الخدمات النشطة', () => {
    expect(buildServiceMatch({})).toEqual({ isActive: true });
  });

  it('يفلتر بمزوّد بعينه — يغذّي تبويب «الخدمات» في الصورة 10', () => {
    const match = buildServiceMatch({ providerId: OID });
    expect(String(match.providerId)).toBe(OID);
  });
});

describe('buildSort', () => {
  it('كل ترتيب ينتهي بفاصل تعادل _id لثبات الصفحات', () => {
    for (const sort of ['rating', 'newest'] as const) {
      expect(buildSort(sort, 'provider')._id).toBe(-1);
      expect(buildSort(sort, 'service')._id).toBe(-1);
    }
  });

  it('لم يعد هناك ترتيب بالسعر — الخيارات المتاحة تقييم وأحدث فقط', () => {
    expect(SORT_OPTIONS).toEqual(['rating', 'newest']);
  });

  it('الأعلى تقييمًا يفكّ التعادل بعدد التقييمات', () => {
    expect(buildSort('rating', 'provider')).toEqual({
      ratingAvg: -1,
      ratingCount: -1,
      _id: -1,
    });
  });

  it('الافتراضي هو الأعلى تقييمًا', () => {
    expect(buildSort(undefined, 'service')).toEqual(buildSort('rating', 'service'));
  });
});

describe('buildPagination', () => {
  it('يحسب التخطي من رقم الصفحة', () => {
    expect(buildPagination({ page: 3, limit: 20 })).toEqual({ skip: 40, limit: 20 });
  });

  it('يحمي من قيم خارج المدى', () => {
    expect(buildPagination({ page: 0, limit: 0 })).toEqual({ skip: 0, limit: 1 });
    expect(buildPagination({ page: -5, limit: 999 })).toEqual({ skip: 0, limit: 50 });
  });

  it('القيم الافتراضية 1 و20', () => {
    expect(buildPagination({})).toEqual({ skip: 0, limit: 20 });
  });
});

describe('مخطط فلاتر الاكتشاف', () => {
  it('يرفض حدًا أدنى للسعر أكبر من الأقصى', () => {
    const result = discoveryQuerySchema.safeParse({ priceMin: '900', priceMax: '100' });
    expect(result.success).toBe(false);
  });

  it('يرفض منطقة خارج قائمة الفيوم', () => {
    expect(discoveryQuerySchema.safeParse({ area: 'المعادي' }).success).toBe(false);
    expect(discoveryQuerySchema.safeParse({ area: 'الفيوم' }).success).toBe(true);
    // الفلترة بالمراكز فقط — الأحياء الفرعية مرفوضة
    expect(discoveryQuerySchema.safeParse({ area: 'حي الجامعة' }).success).toBe(false);
  });

  it('يرفض أي مفتاح غير معرّف (mass-assignment)', () => {
    expect(discoveryQuerySchema.safeParse({ isActive: 'false' }).success).toBe(false);
    expect(discoveryQuerySchema.safeParse({ 'verification.status': 'PENDING_REVIEW' }).success).toBe(
      false
    );
  });

  it('يحوّل الأرقام النصية ويضع الترتيب الافتراضي', () => {
    const result = discoveryQuerySchema.parse({ page: '2', limit: '10', minRating: '4.5' });
    expect(result).toMatchObject({ page: 2, limit: 10, minRating: 4.5, sort: 'rating' });
  });

  it('يحدّ الصفحة الواحدة بخمسين عنصرًا', () => {
    expect(discoveryQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('مخطط البحث الموحّد', () => {
  it('يرفض أقل من حرفين', () => {
    expect(searchQuerySchema.safeParse({ q: 'س' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: 'سب' }).success).toBe(true);
  });

  it('يرفض نصًا يبدأ بمُعامل استعلام', () => {
    expect(searchQuerySchema.safeParse({ q: '$where' }).success).toBe(false);
  });

  it('النوع الافتراضي all', () => {
    expect(searchQuerySchema.parse({ q: 'سباك' }).type).toBe('all');
  });
});

describe('البحث الجزئي (الخطة الثانية)', () => {
  it('الوضع الافتراضي يستخدم الفهرس النصي لا التعبير النمطي', () => {
    const match = buildServiceMatch({ q: 'سباك' });
    expect(match.$text).toEqual({ $search: 'سباك' });
    expect(match.$or).toBeUndefined();
  });

  it('الوضع الجزئي يبحث في حقلي البطاقة بلا فهرس نصي', () => {
    const match = buildServiceMatch({ q: 'كهرب', qMode: 'prefix' });
    expect(match.$text).toBeUndefined();
    expect(match.$or).toEqual([
      { title: { $regex: 'كهرب', $options: 'i' } },
      { description: { $regex: 'كهرب', $options: 'i' } },
    ]);
  });

  it('الوضع الجزئي للمزوّدين يبحث في الاسم والنبذة', () => {
    const match = buildProviderMatch({ q: 'كهرب', qMode: 'prefix' });
    expect(match.$or).toEqual([
      { displayName: { $regex: 'كهرب', $options: 'i' } },
      { bio: { $regex: 'كهرب', $options: 'i' } },
    ]);
    // الحارس باقٍ حتى في الوضع الجزئي
    expect(match.isActive).toBe(true);
    expect(match['verification.status']).toBe('APPROVED');
  });
});

describe('هروب التعبير النمطي', () => {
  it('يحوّل كل محارف التحكم إلى محارف حرفية', () => {
    // String.raw لأن الناتج المتوقّع يحوي شرطات مائلة عكسية حقيقية
    expect(escapeRegex('a.b*c')).toBe(String.raw`a\.b\*c`);
    expect(escapeRegex('(a+)+')).toBe(String.raw`\(a\+\)\+`);
    expect(escapeRegex('^start$')).toBe(String.raw`\^start\$`);
    expect(escapeRegex('[a-z]{2,}')).toBe(String.raw`\[a-z\]\{2,\}`);
  });

  it('لا يغيّر النص العربي العادي', () => {
    expect(escapeRegex('كهربائي الفيوم')).toBe('كهربائي الفيوم');
  });

  it('النمط الناتج يطابق النص حرفيًا لا كتعبير', () => {
    const rx = new RegExp(escapeRegex('.*'));
    expect(rx.test('.*')).toBe(true);
    // بلا هروب كان '.*' ليطابق أي نص
    expect(rx.test('كهربائي')).toBe(false);
  });
});
