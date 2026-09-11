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
import { ALL_FAYOUM_AREAS, FAYOUM_CITIES, GOVERNORATE } from '@/shared/constants/fayoum-areas';
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
  COMPANY: 'شركة أو مؤسسة',
};

export const GENDERS = ['MALE', 'FEMALE'] as const;
export const GENDER_LABELS_AR: Record<(typeof GENDERS)[number], string> = {
  MALE: 'ذكر',
  FEMALE: 'أنثى',
};

/** تاريخ ميلاد منطقي: 18 سنة على الأقل و100 على الأكثر. */
const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صالحة.')
  .refine((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const age = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 18 && age <= 100;
  }, 'يجب أن يكون عمرك 18 سنة على الأقل.');

/**
 * البريد **إلزامي** لمقدم الخدمة (بعكس العميل) — كما هو معلّم بـ`*` في
 * الصورة 19. هو قناة إبلاغه بقرار التوثيق حين لا يكون داخل التطبيق.
 */
export const providerStep1Schema = z
  .object({
    fullName: fullNameSchema,
    phone: egyptPhoneSchema,
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
/* الخطوة 2/4 — المهنة والخدمة (الصورة 20)                             */
/* ================================================================== */

export const PRICE_MODES = ['RANGE', 'LATER'] as const;

/** مناطق التغطية: اختيار متعدد من قائمة الفيوم الثابتة — لا خريطة ولا نطاق. */
const coverageAreasSchema = z
  .array(
    z
      .string()
      .trim()
      .refine((value) => ALL_FAYOUM_AREAS.includes(value), { message: 'منطقة غير صالحة.' })
  )
  .min(1, 'اختر منطقة تغطية واحدة على الأقل.')
  .max(20, 'الحد الأقصى 20 منطقة.');

export const providerStep2Schema = z
  .object({
    categoryId: objectIdSchema,
    professionId: objectIdSchema,
    yearsOfExperience: z.coerce.number().int().min(0).max(70),
    // عدّاد 0/300 في الصورة 20
    bio: safeString(300).refine((value) => value.length >= 20, {
      message: 'وصف الخدمة قصير جدًا — اكتب 20 حرفًا على الأقل.',
    }),
    coverageAreas: coverageAreasSchema,
    priceMode: z.enum(PRICE_MODES).default('LATER'),
    priceMin: z.coerce.number().min(0).max(1_000_000).optional(),
    priceMax: z.coerce.number().min(0).max(1_000_000).optional(),
    // «ما يميّز خدمتك» 0/200 لكل ميزة
    highlights: z.array(safeString(200)).max(6, 'الحد الأقصى 6 مزايا.').default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.priceMode !== 'RANGE') return;

    if (data.priceMin == null || data.priceMax == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'حدّد السعر من وإلى، أو اختر «تحديد السعر لاحقًا».',
        path: ['priceMin'],
      });
      return;
    }
    if (data.priceMin > data.priceMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'الحد الأدنى للسعر يجب ألا يتجاوز الحد الأقصى.',
        path: ['priceMin'],
      });
    }
  });

export type ProviderStep2Values = z.input<typeof providerStep2Schema>;

/* ================================================================== */
/* إنشاء الحساب (الخطوتان 1 و2 معًا)                                   */
/* ================================================================== */

/**
 * الحساب يُنشأ عند الانتقال من الخطوة 2 إلى 3، لا في نهاية المعالج.
 *
 * السبب تقني لا تصميمي: المستندات تُرفع إلى Cloudinary بوضع مقيّد وتُربط
 * بـ`providerId`، فلا يمكن رفعها قبل وجود حساب وملف مزوّد. لذلك ينتهي
 * الطلب في حالة `DRAFT` حتى يُرسَل فعليًا من الخطوة 4.
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
    city: z.enum(FAYOUM_CITIES).optional(),
    addressLine: safeString(100).optional(),
    accountType: z.enum(ACCOUNT_TYPES).optional(),
    gender: z.enum(GENDERS).optional(),
    birthDate: birthDateSchema.optional(),

    categoryId: objectIdSchema.optional(),
    professionId: objectIdSchema.optional(),
    yearsOfExperience: z.coerce.number().int().min(0).max(70).optional(),
    bio: safeString(300).optional(),
    coverageAreas: coverageAreasSchema.optional(),
    priceMode: z.enum(PRICE_MODES).optional(),
    priceMin: z.coerce.number().min(0).max(1_000_000).optional(),
    priceMax: z.coerce.number().min(0).max(1_000_000).optional(),
    highlights: z.array(safeString(200)).max(6).optional(),
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
      .refine((value) => ALL_FAYOUM_AREAS.includes(value), { message: 'منطقة غير صالحة.' })
  )
  .max(20, 'الحد الأقصى 20 منطقة.')
  .default([]);

const providerServiceBaseSchema = z.object({
  title: safeString(120).refine((value) => value.length >= 3, {
    message: 'عنوان الخدمة قصير جدًا.',
  }),
  description: safeString(500).refine((value) => value.length >= 10, {
    message: 'وصف الخدمة قصير جدًا.',
  }),
  priceFrom: z.coerce.number().min(0).max(1_000_000),
  priceTo: z.coerce.number().min(0).max(1_000_000).optional(),
  areas: serviceAreasSchema,
  isActive: z.boolean().default(true),
});

function refinePriceOrder<T extends { priceFrom?: number; priceTo?: number }>(
  data: T,
  ctx: z.RefinementCtx
) {
  if (data.priceTo != null && data.priceFrom != null && data.priceTo < data.priceFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'السعر الأقصى يجب ألا يقل عن السعر الأدنى.',
      path: ['priceTo'],
    });
  }
}

export const createProviderServiceSchema = providerServiceBaseSchema
  .strict()
  .superRefine(refinePriceOrder);

export type CreateProviderServiceInput = z.output<typeof createProviderServiceSchema>;

export const updateProviderServiceSchema = providerServiceBaseSchema
  .partial()
  .strict()
  .superRefine(refinePriceOrder);

export type UpdateProviderServiceInput = z.output<typeof updateProviderServiceSchema>;

export const listMyServicesQuerySchema = paginationSchema.strict();
