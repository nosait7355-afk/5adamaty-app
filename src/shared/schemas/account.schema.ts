import { z } from 'zod';
import {
  egyptPhoneSchema,
  emailSchema,
  fullNameSchema,
  objectIdSchema,
  paginationSchema,
  safeString,
} from './common.schema';
import { ADDRESS_TYPES, ALL_FAYOUM_AREAS, FAYOUM_CITIES, GOVERNORATE } from '@/shared/constants/fayoum-areas';
import { NOTIFICATION_TABS } from '@/shared/constants/notifications';

/**
 * مخططات الأنظمة المساندة (Phase 9): الإشعارات والتقييمات والمراسلة والحساب.
 *
 * ⚠️ «وسائل الدفع» في الصورة 16 عنصر **معلوماتي** لا أكثر: لا يوجد في هذا
 * الملف — ولن يوجد — أي مخطط لبطاقة أو بوابة أو محفظة (ARCHITECTURE §0.1).
 */

/* ================================================================== */
/* الإشعارات — الصورة 15                                               */
/* ================================================================== */

export const listNotificationsQuerySchema = paginationSchema
  .extend({
    tab: z.enum(NOTIFICATION_TABS).default('ALL'),
    unreadOnly: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .strict();

export type ListNotificationsQuery = z.output<typeof listNotificationsQuerySchema>;

export const notificationIdParamSchema = z.object({ id: objectIdSchema }).strict();

/* ================================================================== */
/* التقييمات — شاشة كتابة التقييم (مشتقّة من زر «تقييم الخدمة»)          */
/* ================================================================== */

/**
 * تقييم من 1 إلى 5 نجوم + تعليق اختياري.
 *
 * التقييم **عدد صحيح**: نصف نجمة لا معنى له في التصميم ولا في المتوسط
 * المعروض، والسماح به يفتح بابًا لقيم عشوائية.
 */
export const createReviewSchema = z
  .object({
    rating: z.coerce
      .number()
      .int('التقييم يجب أن يكون عددًا صحيحًا من 1 إلى 5.')
      .min(1, 'اختر تقييمًا من نجمة إلى خمس.')
      .max(5, 'أقصى تقييم خمس نجوم.'),
    comment: safeString(500).optional(),
  })
  .strict();

export type CreateReviewInput = z.output<typeof createReviewSchema>;

/* ================================================================== */
/* المراسلة — شاشة المحادثة (مشتقّة)                                    */
/* ================================================================== */

export const listThreadsQuerySchema = paginationSchema.strict();

export const sendMessageSchema = z
  .object({
    body: safeString(2000).refine((value) => value.trim().length > 0, {
      message: 'اكتب رسالة قبل الإرسال.',
    }),
  })
  .strict();

export type SendMessageInput = z.output<typeof sendMessageSchema>;

export const threadIdParamSchema = z.object({ id: objectIdSchema }).strict();

/* ================================================================== */
/* العناوين — الصورة 17                                                */
/* ================================================================== */

/**
 * عنوان نصي بحت.
 * NON-NEGOTIABLE (ARCHITECTURE §0.2): لا إحداثيات ولا اختيار من خريطة —
 * المنطقة من قائمة الفيوم الثابتة، والباقي نص حر.
 */
export const createAddressSchema = z
  .object({
    label: safeString(60).refine((value) => value.length >= 2, { message: 'اكتب اسمًا للعنوان.' }),
    type: z.enum(ADDRESS_TYPES).default('HOME'),

    governorate: z.string().trim().max(60).default(GOVERNORATE),
    city: z.enum(FAYOUM_CITIES, { message: 'المدينة/المركز غير صالح.' }),
    area: z
      .string()
      .trim()
      .refine((value) => ALL_FAYOUM_AREAS.includes(value), { message: 'المنطقة غير صالحة.' }),
    line: safeString(200).refine((value) => value.length >= 5, {
      message: 'العنوان التفصيلي قصير جدًا.',
    }),
    landmark: safeString(120).optional(),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, 'الرمز البريدي يجب أن يكون 5 أرقام.')
      .optional(),

    contactName: fullNameSchema,
    contactPhone: egyptPhoneSchema,

    isDefault: z.boolean().default(false),
  })
  .strict();

export type CreateAddressInput = z.output<typeof createAddressSchema>;

export const updateAddressSchema = createAddressSchema.partial().strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'لا يوجد ما يُحدَّث.' }
);

export const addressIdParamSchema = z.object({ id: objectIdSchema }).strict();

/* ================================================================== */
/* المفضلة — عدّاد «المفضلة 12» في الصورة 16                            */
/* ================================================================== */

export const createFavoriteSchema = z
  .object({
    providerId: objectIdSchema.optional(),
    serviceId: objectIdSchema.optional(),
  })
  .strict()
  .refine((data) => Boolean(data.providerId) !== Boolean(data.serviceId), {
    message: 'حدّد مقدم خدمة أو خدمة واحدة بالضبط.',
  });

export type CreateFavoriteInput = z.output<typeof createFavoriteSchema>;

/* ================================================================== */
/* الملف الشخصي — «تعديل الملف الشخصي» في الصورة 16                     */
/* ================================================================== */

export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    email: emailSchema.optional(),
    city: z.enum(FAYOUM_CITIES).optional(),
    area: z
      .string()
      .trim()
      .refine((value) => ALL_FAYOUM_AREAS.includes(value), { message: 'المنطقة غير صالحة.' })
      .optional(),
    gender: z.enum(['MALE', 'FEMALE']).optional(),
    avatarPublicId: safeString(200).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'لا يوجد ما يُحدَّث.' });

export type UpdateProfileInput = z.output<typeof updateProfileSchema>;

/* ================================================================== */
/* مركز المساعدة — الصورة 18                                           */
/* ================================================================== */

export const listFaqsQuerySchema = z
  .object({
    topic: safeString(40).optional(),
    q: safeString(100).optional(),
  })
  .strict();

/** «مفيد 🙂 / غير مفيد 🙁» أسفل كل سؤال. */
export const faqFeedbackSchema = z
  .object({
    helpful: z.boolean(),
  })
  .strict();

/**
 * «تواصل معنا».
 *
 * يُنشئ إشعارًا داخليًا ورسالة بريد للدعم — لا تكامل بطرف ثالث ولا webhook.
 */
export const supportContactSchema = z
  .object({
    subject: safeString(120).refine((value) => value.length >= 3, {
      message: 'اكتب موضوع الرسالة.',
    }),
    message: safeString(1000).refine((value) => value.length >= 10, {
      message: 'اكتب رسالتك في 10 أحرف على الأقل.',
    }),
  })
  .strict();

export type SupportContactInput = z.output<typeof supportContactSchema>;
