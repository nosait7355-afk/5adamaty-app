import { describe, expect, it } from 'vitest';
import {
  pluralWordAr,
  formatAddress,
  formatDateShort,
  formatExperience,
  formatNumber,
  formatOrderNumber,
  formatPhone,
  formatPrice,
  formatRating,
  formatRelativeTime,
  formatServicesCount,
  pluralizeAr,
  toE164Egypt,
  truncate,
} from '@/lib/format';

/**
 * القاعدة المحورية من الصور: كل الأرقام تُعرض **لاتينية** داخل النص العربي.
 * لو انزلق التنسيق إلى الأرقام الهندية (٠١٢٣) تفشل هذه الاختبارات.
 */
const ARABIC_INDIC = /[٠-٩۰-۹]/;

describe('formatNumber', () => {
  it('يستخدم أرقامًا لاتينية لا هندية', () => {
    const result = formatNumber(3250);
    expect(result).toBe('3,250');
    expect(result).not.toMatch(ARABIC_INDIC);
  });

  it('يتعامل مع القيم غير الصالحة', () => {
    expect(formatNumber(Number.NaN)).toBe('0');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('formatPrice', () => {
  it('يعرض السعر بصيغة الصور: "150 ج.م"', () => {
    expect(formatPrice(150)).toBe('150 ج.م');
    expect(formatPrice(150)).not.toMatch(ARABIC_INDIC);
  });
});

describe('formatRating', () => {
  it('يقرّب لخانة عشرية واحدة كما في الصور', () => {
    expect(formatRating(4.83)).toBe('4.8');
    expect(formatRating(5)).toBe('5.0');
    expect(formatRating(4.75)).not.toMatch(ARABIC_INDIC);
  });
});

describe('formatOrderNumber', () => {
  it('يسبق الرقم بعلامة #', () => {
    expect(formatOrderNumber(10245)).toBe('#10245');
  });
});

describe('formatPhone', () => {
  it('يجمّع الرقم المحلي كما في الصور: "010 1234 5678"', () => {
    expect(formatPhone('01012345678')).toBe('010 1234 5678');
  });

  it('يتعامل مع الصيغة الدولية', () => {
    expect(formatPhone('+201012345678')).toBe('010 1234 5678');
    expect(formatPhone('201012345678')).toBe('010 1234 5678');
  });

  it('يعيد المدخل كما هو لو لم يكن رقمًا مصريًا صالحًا', () => {
    expect(formatPhone('123')).toBe('123');
  });
});

describe('toE164Egypt', () => {
  it('يحوّل الصيغ المصرية إلى E.164', () => {
    expect(toE164Egypt('01012345678')).toBe('+201012345678');
    expect(toE164Egypt('010 1234 5678')).toBe('+201012345678');
    expect(toE164Egypt('+201012345678')).toBe('+201012345678');
  });

  it('يرفض الأرقام غير الصالحة', () => {
    expect(toE164Egypt('12345')).toBeNull();
    expect(toE164Egypt('02012345678')).toBeNull();
  });
});

describe('التواريخ', () => {
  it('يستخدم أرقامًا لاتينية وأسماء شهور عربية', () => {
    const result = formatDateShort('2025-05-02T10:30:00');
    expect(result).not.toMatch(ARABIC_INDIC);
    expect(result).toContain('مايو');
    expect(result).toContain('2025');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2025-05-02T12:00:00');

  it('يعرض "الآن" لأقل من دقيقة', () => {
    expect(formatRelativeTime(new Date('2025-05-02T11:59:40'), now)).toBe('الآن');
  });

  it('يستخدم صيغة المثنى العربية', () => {
    expect(formatRelativeTime(new Date('2025-05-02T10:00:00'), now)).toBe('منذ ساعتين');
  });

  it('يعرض "منذ 10 دقائق" كما في شاشة الإشعارات', () => {
    expect(formatRelativeTime(new Date('2025-05-02T11:50:00'), now)).toBe('منذ 10 دقائق');
  });

  it('يعرض "أمس" لليوم السابق', () => {
    expect(formatRelativeTime(new Date('2025-05-01T12:00:00'), now)).toBe('أمس');
  });
});

describe('pluralizeAr', () => {
  it('يميّز المفرد والمثنى والجمع', () => {
    expect(pluralizeAr(1, 'دقيقة', 'دقيقتين', 'دقائق')).toBe('دقيقة');
    expect(pluralizeAr(2, 'دقيقة', 'دقيقتين', 'دقائق')).toBe('دقيقتين');
    expect(pluralizeAr(5, 'دقيقة', 'دقيقتين', 'دقائق')).toBe('5 دقائق');
  });

  it('يعود للمفرد عند 11 فأكثر — قاعدة نحوية عربية', () => {
    expect(pluralizeAr(11, 'دقيقة', 'دقيقتين', 'دقائق')).toBe('11 دقيقة');
    expect(pluralizeAr(124, 'خدمة', 'خدمتان', 'خدمات')).toBe('124 خدمة');
  });
});

describe('pluralWordAr', () => {
  it('يعيد المعدود بلا رقم', () => {
    expect(pluralWordAr(1, 'سنة', 'سنتان', 'سنوات')).toBe('سنة');
    expect(pluralWordAr(2, 'سنة', 'سنتان', 'سنوات')).toBe('سنتان');
    expect(pluralWordAr(10, 'سنة', 'سنتان', 'سنوات')).toBe('سنوات');
    expect(pluralWordAr(11, 'سنة', 'سنتان', 'سنوات')).toBe('سنة');
  });
});

describe('formatServicesCount / formatExperience', () => {
  it('يطابق نص الصور', () => {
    expect(formatServicesCount(124)).toBe('124 خدمة');
    expect(formatServicesCount(5)).toBe('5 خدمات');
    expect(formatExperience(10)).toBe('+10 سنوات خبرة');
  });

  it('لا يكرّر الرقم في نص الخبرة', () => {
    // انحدار: النسخة الأولى أنتجت "+10 10 سنوات خبرة"
    expect(formatExperience(10)).not.toMatch(/10\s+10/);
    expect(formatExperience(7)).toBe('+7 سنوات خبرة');
    expect(formatExperience(1)).toBe('+1 سنة خبرة');
    expect(formatExperience(2)).toBe('+2 سنتان خبرة');
    expect(formatExperience(15)).toBe('+15 سنة خبرة');
  });

  it('المفرد والمثنى يحملان العدد فلا يُسبقان برقم', () => {
    expect(formatServicesCount(1)).toBe('خدمة');
    expect(formatServicesCount(2)).toBe('خدمتان');
  });
});

describe('formatAddress', () => {
  it('يبني عنوانًا نصيًا بلا أي إحداثيات', () => {
    expect(
      formatAddress({
        governorate: 'الفيوم',
        area: 'حي الجامعة',
        line: 'شارع أحمد شوقي',
        landmark: 'بجوار مدرسة النور',
      })
    ).toBe('الفيوم - حي الجامعة - شارع أحمد شوقي، بجوار مدرسة النور');
  });

  it('يتجاهل الأجزاء الفارغة', () => {
    expect(formatAddress({ governorate: 'الفيوم', city: null, area: 'سنورس' })).toBe(
      'الفيوم - سنورس'
    );
  });
});

describe('truncate', () => {
  it('يقصّ النص الطويل بثلاث نقاط', () => {
    expect(truncate('نص طويل جدا هنا', 8)).toBe('نص طويل…');
    expect(truncate('قصير', 10)).toBe('قصير');
  });
});
