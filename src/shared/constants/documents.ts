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

/** القيود الظاهرة في الصورة 21: «JPG, PNG حتى 5MB» (+ PDF للمستندات الرسمية). */
export const DOCUMENT_ACCEPTED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const DOCUMENT_MAX_SIZE_MB = 5;

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
 *   - NATIONAL_ID      → دائمًا Required
 *   - PERSONAL_PHOTO   → دائمًا Required
 *   - PROFESSIONAL_CERT→ يظهر Required فقط عند requiresQualification، وإلا يختفي تمامًا
 *   - PRACTICE_LICENSE → يظهر Required فقط عند requiresLicense، وإلا يختفي تمامًا
 *
 * ملاحظة: `ADDRESS_PROOF` كان يُضاف تلقائيًا (Optional) لكل مهنة — أُزيل من
 * القائمة الافتراضية بقرار صريح، ويبقى مفتاحًا صالحًا في `DOCUMENT_KEYS`
 * لأي استخدام لاحق، لكن لا شيء يُنشئه تلقائيًا بعد الآن.
 */
export function buildDocumentRequirements(options: {
  requiresQualification: boolean;
  requiresLicense: boolean;
  /** مستندات إضافية يضيفها Admin بحرية. */
  custom?: DocumentRequirement[];
}): DocumentRequirement[] {
  const list: DocumentRequirement[] = [
    requirement('NATIONAL_ID', true, 1),
    requirement('PERSONAL_PHOTO', true, 2),
  ];

  let order = 3;
  if (options.requiresQualification) {
    list.push(requirement('PROFESSIONAL_CERT', true, order));
    order += 1;
  }
  if (options.requiresLicense) {
    list.push(requirement('PRACTICE_LICENSE', true, order));
    order += 1;
  }

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
 * يتحقق أن قائمة المستندات لا تخالف مفاتيح التحكم.
 * تُستدعى قبل أي حفظ من لوحة Admin؛ المخالفة تُرفض بـ422.
 */
export function validateRequirementsConsistency(
  requirements: readonly DocumentRequirement[],
  flags: { requiresQualification: boolean; requiresLicense: boolean }
): ConsistencyViolation[] {
  const violations: ConsistencyViolation[] = [];
  const byKey = new Map(requirements.filter((r) => r.key !== 'CUSTOM').map((r) => [r.key, r]));

  const nationalId = byKey.get('NATIONAL_ID');
  if (!nationalId) {
    violations.push({ key: 'NATIONAL_ID', message: 'بطاقة الرقم القومي مطلوبة في كل المهن.' });
  } else if (!nationalId.required) {
    violations.push({ key: 'NATIONAL_ID', message: 'بطاقة الرقم القومي يجب أن تكون إلزامية.' });
  }

  const photo = byKey.get('PERSONAL_PHOTO');
  if (!photo) {
    violations.push({ key: 'PERSONAL_PHOTO', message: 'الصورة الشخصية مطلوبة في كل المهن.' });
  } else if (!photo.required) {
    violations.push({ key: 'PERSONAL_PHOTO', message: 'الصورة الشخصية يجب أن تكون إلزامية.' });
  }

  const cert = byKey.get('PROFESSIONAL_CERT');
  if (flags.requiresQualification) {
    if (!cert) {
      violations.push({
        key: 'PROFESSIONAL_CERT',
        message: 'المهنة تتطلب مؤهلًا، فيجب إدراج المؤهل/الشهادة المهنية.',
      });
    } else if (!cert.required) {
      violations.push({
        key: 'PROFESSIONAL_CERT',
        message: 'المهنة تتطلب مؤهلًا، فيجب أن يكون المؤهل إلزاميًا.',
      });
    }
  } else if (cert) {
    violations.push({
      key: 'PROFESSIONAL_CERT',
      message: 'المهنة لا تتطلب مؤهلًا، فلا يجوز إدراج المؤهل/الشهادة المهنية.',
    });
  }

  const license = byKey.get('PRACTICE_LICENSE');
  if (flags.requiresLicense) {
    if (!license) {
      violations.push({
        key: 'PRACTICE_LICENSE',
        message: 'المهنة تتطلب ترخيصًا، فيجب إدراج رخصة مزاولة المهنة.',
      });
    } else if (!license.required) {
      violations.push({
        key: 'PRACTICE_LICENSE',
        message: 'المهنة تتطلب ترخيصًا، فيجب أن تكون الرخصة إلزامية.',
      });
    }
  } else if (license) {
    violations.push({
      key: 'PRACTICE_LICENSE',
      message: 'المهنة لا تتطلب ترخيصًا، فلا يجوز إدراج رخصة مزاولة المهنة.',
    });
  }

  return violations;
}
