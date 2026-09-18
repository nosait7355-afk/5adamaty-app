import { z } from 'zod';
import {
  egyptPhoneSchema,
  emailSchema,
  fullNameSchema,
  literalTrue,
  objectIdSchema,
  paginationSchema,
  passwordSchema,
  safeString,
} from './common.schema';
import { FAYOUM_CITIES, GOVERNORATE, isValidCoverageArea } from '@/shared/constants/fayoum-areas';
import { VERIFICATION_STATUSES } from '@/shared/constants/roles';

/**
 * مخططات تسجيل مقدم الخدمة (Phase 6) — الصور 19 إلى 23.
 *
 * كل مخطط `.strict()`: أي مفتاح غير معرّف يُرفض. هذا هو ما يمنع مقدم
 * الخدمة من تمرير `verification` أو `isVerifiedBadge` أو `isActive` مع
 * بيانات ملفه — تلك الحقول لا وجود لها في أي مخطط يكتبه غير الإدارة.
 */

/* ================================================================== */
/* الخطوة 1/4 — البيانات الأساسية (الصورة 19)                          */
/* ================================================================== */

export const ACCOUNT_TYPES = ['INDIVIDUAL', 'COMPANY'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS_AR: Record<AccountType, string> = {
  INDIVIDUAL: 'شخصي',
  COMPANY: 'شركة',
};

export const GENDERS = ['MALE', 'FEMALE'] as const;
export const GENDER_LABELS_AR: Record<(typeof GENDERS)[number], string> = {
  MALE: 'ذكر',
  FEMALE: 'أنثى',
};

/** تاريخ ميلاد منطقي: 18 سنة على الأقل و100 على الأكثر. */
const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'أكمل اليوم والشهر والسنة.')
  .refine((value) => {
    /*
     * التحقق من أن التاريخ موجود فعلًا: `new Date('2000-02-31')` لا يفشل
     * دائمًا بل قد يُرحَّل إلى مارس، فنقارن الأجزاء بعد التحويل.
     */
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    );
  }, 'هذا التاريخ غير موجود — راجع اليوم والشهر.')
  .refine((value) => {
    const age = (Date.now() - new Date(value).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 18 && age <= 100;
  }, 'يجب أن يكون عمرك بين 18 و100 سنة.');

/**
 * البريد **إلزامي** لمقدم الخدمة (بعكس العميل) — كما هو معلّم بـ`*` في
 * الصورة 19. هو قناة إبلاغه بقرار التوثيق حين لا يكون داخل التطبيق.
 */
/**
 * رقم الواتساب — 11 رقمًا يبدأ بـ01، ويُخزَّن بالصيغة المحلية كما كُتب.
 * منفصل عن رقم الهاتف لأن كثيرًا من الحرفيين يستخدمون رقمًا آخر للواتساب.
 */
export const whatsappSchema = z
  .string({ message: 'رقم الواتساب مطلوب.' })
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => /^01\d{9}$/.test(value), {
    message: 'رقم الواتساب يجب أن يكون 11 رقمًا ويبدأ بـ 01.',
  });

export const providerStep1Schema = z
  .object({
    fullName: fullNameSchema,
    phone: egyptPhoneSchema,
    whatsapp: whatsappSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),

    governorate: z.string().trim().max(60).default(GOVERNORATE),
    city: z.enum(FAYOUM_CITIES, { message: 'المدينة/المركز غير صالح.' }),
    addressLine: safeString(100).refine((value) => value.length >= 5, {
      message: 'العنوان التفصيلي قصير جدًا.',
    }),

    accountType: z.enum(ACCOUNT_TYPES).default('INDIVIDUAL'),
    gender: z.enum(GENDERS).optional(),
    birthDate: birthDateSchema.optional(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين.',
    path: ['confirmPassword'],
  });

export type ProviderStep1Values = z.input<typeof providerStep1Schema>;

/* ================================================================== */
/* الخطوة 2/3 — المهنة والخدمة (الصورة 20)                             */
/* ================================================================== */

/**
 * سنوات الخبرة — اختيارية. الحقل الفارغ في النموذج يصل نصًّا فارغًا، و
 * `z.coerce` كان سيحوّله إلى صفر فيُعرض «+0 سنوات خبرة»؛ لذلك نحوّله إلى
 * `undefined` أولًا.
 */
const yearsOfExperienceSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce
    .number({ message: 'أدخل رقمًا صحيحًا.' })
    .int('أدخل رقمًا صحيحًا.')
    .min(0, 'القيمة لا يمكن أن تكون سالبة.')
    .max(70, 'القيمة أكبر من المسموح.')
    .optional()
);

/** مناطق التغطية: اختيار متعدد من مراكز الفيوم الخمسة — لا أحياء ولا خريطة. */
const coverageAreasSchema = z
  .array(
    z
      .string()
      .trim()
      .refine((value) => isValidCoverageArea(value), { message: 'اختر من مراكز الفيوم الخمسة.' })
  )
  .min(1, 'اختر منطقة تغطية واحدة على الأقل.')
  .max(5, 'الحد الأقصى 5 مراكز.');

export const providerStep2Schema = z
  .object({
    categoryId: objectIdSchema,
    professionId: objectIdSchema,
    yearsOfExperience: yearsOfExperienceSchema,
    /*
     * عدّاد 0/300 في الصورة 20. لا حدّ أدنى لعدد الحروف بقرار صريح: السقف
     * وحده محفوظ لأنه قيد تخزين وعرض، أما الطول الأدنى فكان يعرقل التسجيل
     * بلا فائدة.
     */
    bio: safeString(300),
    coverageAreas: coverageAreasSchema,
  })
  .strict();

export type ProviderStep2Values = z.input<typeof providerStep2Schema>;

/* ================================================================== */
/* إنشاء الحساب (الخطوتان 1 و2 معًا)                                   */
/* ================================================================== */

/**
 * الحساب يُنشأ عند الانتقال من الخطوة 2 إلى 3، لا في نهاية المعالج.
 *
 * السبب تقني لا تصميمي: المستندات تُرفع إلى Cloudinary بوضع مقيّد وتُربط
 * بـ`providerId`، فلا يمكن رفعها قبل وجود حساب وملف مزوّد. لذلك ينتهي
 * الطلب في حالة `DRAFT` حتى يُرسَل فعليًا من الخطوة 3.
 */
export const registerProviderSchema = z
  .object({
    step1: providerStep1Schema,
    step2: providerStep2Schema,
  })
  .strict();

export type RegisterProviderInput = z.output<typeof registerProviderSchema>;

/* ================================================================== */
/* تعديل الملف من شاشة المراجعة (أزرار «تعديل» في الصورة 22)            */
/* ================================================================== */

/**
 * الحقول القابلة للتعديل من المزوّد نفسه.
 *
 * ملاحظة أمنية: `verification` و`isVerifiedBadge` و`isActive` و`role`
 * **غير موجودة هنا إطلاقًا**، و`.strict()` يرفض أي محاولة لتمريرها بـ400.
 */
export const updateProviderProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    email: emailSchema.optional(),
    whatsapp: whatsappSchema.optional(),
    city: z.enum(FAYOUM_CITIES).optional(),
    addressLine: safeString(100).optional(),
    accountType: z.enum(ACCOUNT_TYPES).optional(),
    gender: z.enum(GENDERS).optional(),
    birthDate: birthDateSchema.optional(),

    categoryId: objectIdSchema.optional(),
    professionId: objectIdSchema.optional(),
    yearsOfExperience: yearsOfExperienceSchema,
    bio: safeString(300).optional(),
    coverageAreas: coverageAreasSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'لا يوجد ما يُحدَّث.',
  });

export type UpdateProviderProfileInput = z.output<typeof updateProviderProfileSchema>;

/* ================================================================== */
/* إرسال الطلب وقرارات الإدارة                                          */
/* ================================================================== */

/** تعهّد المزوّد قبل الإرسال — Checkbox الصورة 22. */
export const submitVerificationSchema = z
  .object({
    acceptTerms: literalTrue('يجب الإقرار بصحة البيانات والموافقة على الشروط.'),
  })
  .strict();

/** القرارات التي يملكها ADMIN وحده. */
export const ADMIN_DECISIONS = ['APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED'] as const;
export type AdminDecision = (typeof ADMIN_DECISIONS)[number];

export const verificationDecisionSchema = z
  .object({
    status: z.enum(ADMIN_DECISIONS),
    reason: safeString(500).optional(),
  })
  .strict()
  .refine((data) => data.status === 'APPROVED' || Boolean(data.reason), {
    message: 'السبب مطلوب عند الرفض أو طلب إعادة الإرسال.',
    path: ['reason'],
  });

export type VerificationDecisionInput = z.output<typeof verificationDecisionSchema>;

/** طابور مراجعة الإدارة. */
export const adminProvidersQuerySchema = paginationSchema
  .extend({
    status: z.enum(VERIFICATION_STATUSES).default('PENDING_REVIEW'),
  })
  .strict();

/* ================================================================== */
/* خدمات مقدم الخدمة («خدماتي») — إدارة قوائم الخدمات المعروضة للعملاء   */
/* ================================================================== */

/**
 * الحد الأقصى لعدد الخدمات لكل مزوّد — يمنع إنشاء أعداد غير معقولة من
 * القوائم (ARCHITECTURE §7: كل حد أعلى مفروض على الخادم لا الواجهة فقط).
 */
export const MAX_SERVICES_PER_PROVIDER = 20;

const serviceAreasSchema = z
  .array(
    z
      .string()
      .trim()
      .refine((value) => isValidCoverageArea(value), { message: 'اختر من مراكز الفيوم الخمسة.' })
  )
  .max(5, 'الحد الأقصى 5 مراكز.')
  .default([]);

const providerServiceBaseSchema = z.object({
  title: safeString(120).refine((value) => value.length >= 3, {
    message: 'عنوان الخدمة قصير جدًا.',
  }),
  description: safeString(500).refine((value) => value.length >= 10, {
    message: 'وصف الخدمة قصير جدًا.',
  }),
  areas: serviceAreasSchema,
  isActive: z.boolean().default(true),
});

export const createProviderServiceSchema = providerServiceBaseSchema.strict();

export type CreateProviderServiceInput = z.output<typeof createProviderServiceSchema>;

export const updateProviderServiceSchema = providerServiceBaseSchema.partial().strict();

export type UpdateProviderServiceInput = z.output<typeof updateProviderServiceSchema>;

export const listMyServicesQuerySchema = paginationSchema.strict();
