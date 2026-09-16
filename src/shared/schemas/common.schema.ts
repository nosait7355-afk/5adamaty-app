import { z } from 'zod';
import { ALL_FAYOUM_AREAS, FAYOUM_CITIES, GOVERNORATE } from '@/shared/constants/fayoum-areas';

/**
 * مخططات Zod المشتركة.
 *
 * كل مخطط يستخدم `.strict()` — أي مفتاح غير معرّف يُرفض. هذا يقطع
 * mass-assignment: لا يستطيع العميل تمرير `role` أو `status` أو
 * `isVerifiedBadge` عبر أي endpoint (ARCHITECTURE §7).
 */

/** معرّف MongoDB — 24 حرفًا ست عشريًا. */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'المعرّف غير صالح.');

/** slug لاتيني. */
export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, 'الـslug غير صالح.');

/**
 * رقم هاتف مصري — يقبل الصيغ المحلية والدولية ويطبّعها إلى E.164.
 * التطبيق لا يرسل أي رسالة نصية ولا كود تحقق (لا OTP)؛ الرقم معرّف دخول فقط.
 */
export const egyptPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => /^(\+?20)?1\d{9}$/.test(value) || /^01\d{9}$/.test(value), {
    message: 'رقم الهاتف غير صالح. مثال: 01012345678',
  })
  .transform((value) => {
    const digits = value.replace(/\D/g, '');
    if (/^01\d{9}$/.test(digits)) return `+20${digits.slice(1)}`;
    if (/^201\d{9}$/.test(digits)) return `+${digits}`;
    return `+20${digits}`;
  });

/**
 * بريد إلكتروني صحيح.
 *
 * `z.email()` وحده يقبل دومينات مثل `name@gmail.37.com` لأن شكلها سليم
 * تقنيًا. نشترط فوق ذلك أن يحتوي **كل** مقطع من الدومين حرفًا واحدًا على
 * الأقل (فلا مقاطع رقمية بحتة)، وأن ينتهي بامتداد حروف فقط (.com، .eg…).
 */
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@(?:[a-z0-9-]*[a-z][a-z0-9-]*\.)+[a-z]{2,}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('البريد الإلكتروني غير صالح.')
  .max(160)
  .refine((value) => EMAIL_PATTERN.test(value), {
    message: 'البريد الإلكتروني غير صالح. مثال: name@gmail.com',
  });

/**
 * كلمة المرور: 8 أحرف على الأقل + حرف + رقم (ARCHITECTURE §7).
 * الحد الأعلى 128 يمنع هجمات DoS على دالة التجزئة.
 */
export const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
  .max(128, 'كلمة المرور طويلة جدًا.')
  .regex(/[A-Za-z؀-ۿ]/, 'كلمة المرور يجب أن تحتوي حرفًا واحدًا على الأقل.')
  .regex(/\d/, 'كلمة المرور يجب أن تحتوي رقمًا واحدًا على الأقل.');

export const fullNameSchema = z
  .string()
  .trim()
  .min(3, 'الاسم قصير جدًا.')
  .max(100, 'الاسم طويل جدًا.');

/**
 * العنوان النصي.
 * NON-NEGOTIABLE: لا حقول إحداثيات — الاختيار من قائمة مناطق الفيوم الثابتة.
 */
export const textAddressSchema = z
  .object({
    governorate: z.string().trim().max(60).default(GOVERNORATE),
    city: z.enum(FAYOUM_CITIES, { message: 'المدينة/المركز غير صالح.' }),
    area: z
      .string()
      .trim()
      .refine((value) => ALL_FAYOUM_AREAS.includes(value), { message: 'المنطقة غير صالحة.' }),
    line: z.string().trim().min(3, 'العنوان قصير جدًا.').max(200),
    landmark: z.string().trim().max(120).optional(),
    postalCode: z.string().trim().regex(/^\d{5}$/, 'الرمز البريدي غير صالح.').optional(),
  })
  .strict();

/** وقت بصيغة HH:mm. */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'صيغة الوقت غير صالحة.');

/** معاملات الترقيم الموحّدة. */
export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * نص حر آمن — يمنع حقن NoSQL في القيم القادمة من المستخدم.
 * `sanitizeFilter` في Mongoose يغطي المُعاملات، وهذا خط دفاع ثانٍ.
 *
 * دالة مصنع لا ثابت، لأن `.refine()` تُنتج ZodEffects التي لا تقبل `.max()`
 * بعدها — فنطبّق الحد أولًا ثم التنقية.
 */
export const safeString = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !value.startsWith('$') && !value.includes('\0'), {
      message: 'قيمة غير مسموح بها.',
    });

export const safeStringSchema = safeString();

/**
 * خانة تأكيد إلزامية (`true` حرفيًا) برسالة عربية في كل الحالات.
 *
 * `z.literal(true, { message })` لا يكفي: الرسالة تُطبَّق على خطأ **النوع**
 * فقط، أما إرسال `false` صراحةً فيقع في مسار `invalid_literal` فتظهر
 * رسالة Zod الإنجليزية الافتراضية للمستخدم. `errorMap` يغطّي المسارين.
 */
export const literalTrue = (message: string) =>
  z.literal(true, { errorMap: () => ({ message }) });
