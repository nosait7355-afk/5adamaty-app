import { describe, expect, it } from 'vitest';
import {
  arabicSearchPattern,
  findArabic,
  includesArabic,
  normalizeArabic,
} from '@/shared/arabic';

/**
 * مطابقة العربية كما تُكتب على الهاتف: بلا تشكيل ولا همزات دقيقة.
 */

describe('normalizeArabic', () => {
  it('يزيل التشكيل والتطويل ويوحّد الألف والياء والتاء المربوطة', () => {
    expect(normalizeArabic('سبّاك')).toBe('سباك');
    expect(normalizeArabic('محامٍ')).toBe('محام');
    expect(normalizeArabic('إطسا')).toBe('اطسا');
    expect(normalizeArabic('مستشفى')).toBe('مستشفي');
    expect(normalizeArabic('نجّارة')).toBe('نجاره');
    expect(normalizeArabic('كـهـربـاء')).toBe('كهرباء');
  });
});

describe('findArabic — اقتراحات البحث وإبرازها', () => {
  it('«سبا» تجد «سبّاك» وتبرز الشدة مع حرفها', () => {
    const range = findArabic('سبّاك', 'سبا');
    expect(range).toEqual({ start: 0, end: 4 });
    expect('سبّاك'.slice(range!.start, range!.end)).toBe('سبّا');
  });

  it('همزة الكتالوج لا تمنع كتابة المستخدم بلا همزة، والعكس', () => {
    expect(includesArabic('إطسا', 'اطسا')).toBe(true);
    expect(includesArabic('اطسا', 'إطسا')).toBe(true);
    expect(includesArabic('فني أجهزة منزلية', 'اجهزه')).toBe(true);
  });

  it('لا يطابق ما لا يحتويه النص، ولا الاستعلام الفارغ', () => {
    expect(findArabic('كهربائي', 'سبا')).toBeNull();
    expect(findArabic('كهربائي', '   ')).toBeNull();
  });
});

describe('arabicSearchPattern — البحث الجزئي على الخادم', () => {
  const matches = (query: string, text: string) =>
    new RegExp(arabicSearchPattern(query), 'i').test(text);

  it('«سباك» تطابق «سبّاك» المخزّنة بالشدة', () => {
    expect(matches('سباك', 'سبّاك صحي بخبرة')).toBe(true);
    expect(matches('كهرب', 'فني كهرباء')).toBe(true);
    expect(matches('اطسا', 'مركز إطسا')).toBe(true);
    expect(matches('سباك', 'كهربائي')).toBe(false);
  });

  it('محارف التعبير النمطي في نص المستخدم حرفية — لا ReDoS ولا «أي شيء»', () => {
    expect(matches('.*', 'أي نص')).toBe(false);
    expect(matches('.*', 'نص فيه .* حرفيًا')).toBe(true);
    expect(matches('(a+)+', '(a+)+')).toBe(true);
  });
});
