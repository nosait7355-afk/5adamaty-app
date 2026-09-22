/**
 * مناطق محافظة الفيوم — **بيانات نصية بحتة**.
 *
 * NON-NEGOTIABLE (ARCHITECTURE §0.2): لا إحداثيات، لا lat/lng، لا GeoJSON،
 * لا فهارس 2dsphere، لا خرائط، لا حساب مسافات. اختيار المنطقة يتم من هذه
 * القائمة الثابتة فقط — لا من خريطة ولا من GPS.
 */

export const GOVERNORATE = 'الفيوم' as const;

/** المراكز والمدن التابعة لمحافظة الفيوم. */
export const FAYOUM_CITIES = [
  'الفيوم',
  'سنورس',
  'طامية',
  'إطسا',
  'إبشواي',
  'يوسف الصديق',
] as const;

export type FayoumCity = (typeof FAYOUM_CITIES)[number];

/** الأحياء والمناطق داخل كل مركز — كما وردت في الصور المرجعية. */
export const FAYOUM_AREAS: Record<string, readonly string[]> = {
  الفيوم: [
    'حي الجامعة',
    'الحوّاتم',
    'دار الرماد',
    'حي السلام',
    'حي النصر',
    'حي الترعة',
    'الحوامي',
    'شارع البحر',
    'المدينة المنورة',
    'قارون',
    'الجمهورية',
    'المسلة',
  ],
  سنورس: ['سنورس البلد', 'شارع الوحدة', 'المنشية', 'الروضة'],
  طامية: ['طامية البلد', 'الشواشنة', 'العزب'],
  إطسا: ['إطسا البلد', 'قحافة', 'منشأة الجمال'],
  إبشواي: ['إبشواي البلد', 'تطون', 'قصر الجبالي'],
  'يوسف الصديق': ['يوسف الصديق البلد'],
};

/**
 * مراكز ومناطق أُزيلت من القائمة المعتمدة — يستخدمها سكربت الهجرة وحده
 * لتحويل السجلات القديمة. لا تُستخدم في أي واجهة أو تحقّق.
 *
 * ملاحظة: «يوسف الصديق» كان هنا (يتحوّل إلى إبشواي) قبل أن يعود مركزًا
 * مستقلًا في `FAYOUM_CITIES` — أُزيل من هذين المدخلين تفاديًا لتناقضهما مع
 * القائمة المعتمدة الحالية.
 */
export const RETIRED_CITY_MIGRATIONS: Record<string, FayoumCity> = {
  الحادقة: 'الفيوم',
  'أبشواي الجديدة': 'إبشواي',
};

export const RETIRED_AREA_MIGRATIONS: Record<string, { city: FayoumCity; area: string }> = {
  'قارون الجديدة': { city: 'إبشواي', area: 'تطون' },
  الحامولي: { city: 'إبشواي', area: 'قصر الجبالي' },
};

/**
 * مناطق تغطية مقدم الخدمة وخدماته — **المراكز الخمسة فقط** بلا أحياء فرعية.
 * الأحياء (`FAYOUM_AREAS`) باقية لعناوين العملاء وحدها.
 */
export const COVERAGE_AREAS: readonly FayoumCity[] = FAYOUM_CITIES;

export function isValidCoverageArea(value: string): boolean {
  return (COVERAGE_AREAS as readonly string[]).includes(value);
}

/**
 * يحوّل قيمة تغطية قديمة (حيّ، أو مركز/حيّ ملغى) إلى مركزها. يُستخدم في
 * الهجرة والبذر. يعيد `null` لقيمة لا يُعرف مركزها.
 */
export function coverageCityOf(value: string): FayoumCity | null {
  if (isValidCoverageArea(value)) return value as FayoumCity;
  if (RETIRED_CITY_MIGRATIONS[value]) return RETIRED_CITY_MIGRATIONS[value];
  if (RETIRED_AREA_MIGRATIONS[value]) return RETIRED_AREA_MIGRATIONS[value].city;
  for (const [city, areas] of Object.entries(FAYOUM_AREAS)) {
    if (areas.includes(value) && isValidCoverageArea(city)) return city as FayoumCity;
  }
  return null;
}

/** يحوّل قائمة تغطية قديمة إلى مراكز بلا تكرار، محافظًا على الترتيب. */
export function toCoverageCities(values: readonly string[]): FayoumCity[] {
  const result: FayoumCity[] = [];
  for (const value of values) {
    const city = coverageCityOf(value);
    if (city && !result.includes(city)) result.push(city);
  }
  return result;
}

/** كل المناطق في قائمة واحدة مسطّحة — لعناوين العملاء. */
export const ALL_FAYOUM_AREAS: readonly string[] = Object.values(FAYOUM_AREAS).flat();

/** مناطق التغطية المتاحة للمزوّد — نفس القائمة. */
export function getAreasForCity(city: string): readonly string[] {
  return FAYOUM_AREAS[city] ?? [];
}

export function isValidArea(area: string): boolean {
  return ALL_FAYOUM_AREAS.includes(area);
}

export function isValidCity(city: string): boolean {
  return (FAYOUM_CITIES as readonly string[]).includes(city);
}

/** أنواع العنوان كما تظهر في شاشة «عناويني» (الصورة 17). */
export const ADDRESS_TYPES = ['HOME', 'WORK', 'FAMILY', 'OTHER'] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export const ADDRESS_TYPE_LABELS_AR: Record<AddressType, string> = {
  HOME: 'المنزل',
  WORK: 'العمل',
  FAMILY: 'عنوان الوالدين',
  OTHER: 'أخرى',
};
