/**
 * محرّك المستندات الديناميكية (ARCHITECTURE §3.3).
 *
 * شاشة المستندات (3/4) تُبنى بالكامل من `professions.documentRequirements`
 * ولا تحتوي أي قائمة ثابتة في الكود. Admin يحرّرها من لوحة التحكم
 * بدون تعديل الكود أو إعادة النشر.
 */

export const DOCUMENT_KEYS = [
  'NATIONAL_ID',
  'PERSONAL_PHOTO',
  'PROFESSIONAL_CERT',
  'PRACTICE_LICENSE',
  'ADDRESS_PROOF',
  'CUSTOM',
] as const;

export type DocumentKey = (typeof DOCUMENT_KEYS)[number];

export const DOCUMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** تصنيف المهنة — حرفية أم منظَّمة. */
export const PROFESSION_KINDS = ['CRAFT', 'REGULATED'] as const;
export type ProfessionKind = (typeof PROFESSION_KINDS)[number];

/** النصوص العربية الافتراضية لكل مستند — كما تظهر في الصورة 21. */
export const DOCUMENT_DEFAULTS: Record<
  Exclude<DocumentKey, 'CUSTOM'>,
  { label: string; description: string }
> = {
  NATIONAL_ID: {
    label: 'الهوية الشخصية',
    description: 'صورة واضحة من البطاقة الشخصية (الوجهين)',
  },
  PERSONAL_PHOTO: {
    label: 'صورة شخصية',
    description: 'صورة شخصية حديثة وواضحة',
  },
  PROFESSIONAL_CERT: {
    label: 'مؤهل أو شهادة مهنية',
    description: 'ارفع الشهادة أو المؤهل الخاص بمهنتك',
  },
  PRACTICE_LICENSE: {
    label: 'رخصة مزاولة المهنة',
    description: 'ارفع رخصة مزاولة المهنة سارية',
  },
  ADDRESS_PROOF: {
    label: 'إثبات العنوان',
    description: 'فاتورة مرافق أو عقد إيجار حديث',
  },
};

/** قيود الرفع: «JPG, PNG حتى 3MB» (+ PDF للمستندات الرسمية). */
export const DOCUMENT_ACCEPTED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const DOCUMENT_MAX_SIZE_MB = 3;

export interface DocumentRequirement {
  key: DocumentKey;
  /** إلزامي فقط عند key === 'CUSTOM'. */
  customKey?: string;
  label: string;
  description: string;
  required: boolean;
  order: number;
  accept: string[];
  maxSizeMB: number;
  isActive: boolean;
}

function requirement(
  key: Exclude<DocumentKey, 'CUSTOM'>,
  required: boolean,
  order: number
): DocumentRequirement {
  return {
    key,
    label: DOCUMENT_DEFAULTS[key].label,
    description: DOCUMENT_DEFAULTS[key].description,
    required,
    order,
    accept: [...DOCUMENT_ACCEPTED_MIME],
    maxSizeMB: DOCUMENT_MAX_SIZE_MB,
    isActive: true,
  };
}

/**
 * يبني قائمة المستندات من مفاتيح التحكم الثلاثة.
 *
 * قاعدة الاتساق (PROJECT_PLAN — قواعد المستندات الديناميكية):
 *   - NATIONAL_ID      → دائمًا Required — وهو **المستند الإلزامي الوحيد**
 *   - PERSONAL_PHOTO   → يظهر دائمًا، اختياري
 *   - PROFESSIONAL_CERT→ يظهر دائمًا، اختياري
 *   - PRACTICE_LICENSE → يظهر دائمًا، اختياري
 *
 * تخفيف الإلزام قرار منتج صريح: التسجيل كان يتعثّر عند مستندات يصعب على
 * الحرفي توفيرها فورًا. `requiresQualification` و`requiresLicense` ما زالا
 * يُقرآن، لكنهما لم يعودا يرفعان المستند إلى إلزامي.
 *
 * ملاحظة: `ADDRESS_PROOF` كان يُضاف تلقائيًا (Optional) لكل مهنة — أُزيل من
 * القائمة الافتراضية بقرار صريح، ويبقى مفتاحًا صالحًا في `DOCUMENT_KEYS`
 * لأي استخدام لاحق، لكن لا شيء يُنشئه تلقائيًا بعد الآن.
 */
export function buildDocumentRequirements(options: {
  /** تُقرأ من المهنة ولم تعد ترفع أي مستند إلى إلزامي — انظر الشرح أعلاه. */
  requiresQualification?: boolean;
  requiresLicense?: boolean;
  /** مستندات إضافية يضيفها Admin بحرية. */
  custom?: DocumentRequirement[];
}): DocumentRequirement[] {
  const list: DocumentRequirement[] = [
    requirement('NATIONAL_ID', true, 1),
    requirement('PERSONAL_PHOTO', false, 2),
    requirement('PROFESSIONAL_CERT', false, 3),
    requirement('PRACTICE_LICENSE', false, 4),
  ];

  const order = 5;

  if (options.custom?.length) {
    options.custom.forEach((item, index) => {
      list.push({ ...item, order: order + index });
    });
  }

  return list;
}

export interface ConsistencyViolation {
  key: DocumentKey;
  message: string;
}

/**
 * يتحقق أن قائمة المستندات لا تخالف القاعدة الوحيدة الباقية: وجود الهوية
 * إلزاميةً. تُستدعى قبل أي حفظ من لوحة Admin؛ المخالفة تُرفض بـ422.
 *
 * `_flags` لم تعد تُقرأ — بقيت في التوقيع حتى لا تتغيّر نداءات المستدعين.
 */
export function validateRequirementsConsistency(
  requirements: readonly DocumentRequirement[],
  _flags?: { requiresQualification: boolean; requiresLicense: boolean }
): ConsistencyViolation[] {
  const violations: ConsistencyViolation[] = [];
  const byKey = new Map(requirements.filter((r) => r.key !== 'CUSTOM').map((r) => [r.key, r]));

  /*
   * بقيت قاعدة واحدة: الهوية. كل ما عداها اختياري ويحرّره Admin بحرية،
   * بما في ذلك جعله إلزاميًا لمهنة بعينها إن شاء — لا شيء يمنع ذلك، لكن
   * لا شيء يفرضه أيضًا.
   */
  const nationalId = byKey.get('NATIONAL_ID');
  if (!nationalId) {
    violations.push({ key: 'NATIONAL_ID', message: 'بطاقة الرقم القومي مطلوبة في كل المهن.' });
  } else if (!nationalId.required) {
    violations.push({ key: 'NATIONAL_ID', message: 'بطاقة الرقم القومي يجب أن تكون إلزامية.' });
  }

  return violations;
}
