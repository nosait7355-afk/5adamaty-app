import { z } from 'zod';
import { objectIdSchema, paginationSchema, safeString, slugSchema } from './common.schema';
import { USER_ROLES, USER_STATUSES } from '@/shared/constants/roles';
import { DOCUMENT_ACCEPTED_MIME, DOCUMENT_KEYS, PROFESSION_KINDS } from '@/shared/constants/documents';
import { ORDER_STATUSES } from '@/shared/constants/order-status';
import { NOTIFICATION_TYPES } from '@/shared/constants/notifications';

/**
 * مخططات لوحة الإدارة (Phase 10).
 *
 * كل مسار يستخدم هذه المخططات محروس بـ`requireRole(request, 'ADMIN')` على
 * مستوى الـroute — انظر ARCHITECTURE §7. المخططات هنا تمنع mass-assignment
 * فقط؛ التفويض نفسه مسؤولية الـmiddleware لا الـschema.
 */

/* ================================================================== */
/* المستخدمون                                                          */
/* ================================================================== */

export const listUsersQuerySchema = paginationSchema
  .extend({
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
    q: safeString(100).optional(),
  })
  .strict();

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const setUserStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED']),
    reason: safeString(300).optional(),
  })
  .strict();

export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;

/* ================================================================== */
/* التصنيفات                                                           */
/* ================================================================== */

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: slugSchema,
    description: z.string().trim().min(3).max(200),
    icon: z.string().trim().min(1).max(40),
    color: z.string().trim().max(20).optional(),
    order: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const listAdminCategoriesQuerySchema = z
  .object({ includeInactive: z.enum(['true', 'false']).default('true') })
  .strict();

/* ================================================================== */
/* المهن + متطلبات المستندات الديناميكية                                */
/* ================================================================== */

/**
 * عنصر متطلّب مستند — نفس شكل `DocumentRequirement` من
 * `shared/constants/documents.ts` لكن بصيغة Zod للتحقق من مدخلات الإدارة.
 *
 * القيد الحاسم يُفرض على مستوى قاعدة البيانات في `profession.model.ts`
 * (`pre('validate')`)، وهذا المخطط يتحقق فقط من شكل كل عنصر على حدة.
 */
const documentRequirementInputSchema = z
  .object({
    key: z.enum(DOCUMENT_KEYS),
    customKey: z.string().trim().min(1).max(40).optional(),
    label: z.string().trim().min(2).max(80),
    description: z.string().trim().min(2).max(160),
    required: z.boolean(),
    order: z.number().int().min(0).max(100),
    accept: z.array(z.enum(DOCUMENT_ACCEPTED_MIME)).min(1),
    maxSizeMB: z.number().int().min(1).max(5),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((data) => data.key !== 'CUSTOM' || Boolean(data.customKey), {
    message: 'المستند المخصّص يحتاج مفتاحًا مميزًا.',
    path: ['customKey'],
  });

export const createProfessionSchema = z
  .object({
    categoryId: objectIdSchema,
    name: z.string().trim().min(2).max(80),
    slug: slugSchema,
    icon: z.string().trim().min(1).max(40),
    order: z.number().int().min(0).max(1000).default(0),
    professionKind: z.enum(PROFESSION_KINDS),
    requiresQualification: z.boolean(),
    requiresLicense: z.boolean(),
    documentRequirements: z.array(documentRequirementInputSchema).min(1),
  })
  .strict();

export type CreateProfessionInput = z.infer<typeof createProfessionSchema>;

export const updateProfessionSchema = createProfessionSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();

export type UpdateProfessionInput = z.infer<typeof updateProfessionSchema>;

export const listAdminProfessionsQuerySchema = z
  .object({
    categoryId: objectIdSchema.optional(),
    includeInactive: z.enum(['true', 'false']).default('true'),
  })
  .strict();

/* ================================================================== */
/* الخدمات (إشراف)                                                     */
/* ================================================================== */

export const listAdminServicesQuerySchema = paginationSchema
  .extend({
    q: safeString(100).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    providerId: objectIdSchema.optional(),
  })
  .strict();

export const setServiceActiveSchema = z
  .object({ isActive: z.boolean(), reason: safeString(300).optional() })
  .strict();

export type SetServiceActiveInput = z.infer<typeof setServiceActiveSchema>;

/* ================================================================== */
/* الطلبات (قراءة إشرافية)                                             */
/* ================================================================== */

export const listAdminOrdersQuerySchema = paginationSchema
  .extend({
    status: z.enum(ORDER_STATUSES).optional(),
    q: safeString(100).optional(),
  })
  .strict();

/* ================================================================== */
/* التقييمات (إشراف)                                                   */
/* ================================================================== */

export const listAdminReviewsQuerySchema = paginationSchema
  .extend({
    isVisible: z.enum(['true', 'false']).optional(),
    providerId: objectIdSchema.optional(),
  })
  .strict();

export const setReviewVisibilitySchema = z
  .object({ isVisible: z.boolean(), adminNote: safeString(300).optional() })
  .strict();

export type SetReviewVisibilityInput = z.infer<typeof setReviewVisibilitySchema>;

/* ================================================================== */
/* الإشعارات العامة (Broadcast)                                        */
/* ================================================================== */

/**
 * بث إشعار — يقتصر النوع على `PROMOTION` أو `SYSTEM` عمدًا؛ لا تسمح هذه
 * الشاشة بإرسال أنواع مرتبطة بكيان (طلب/مزوّد) لأنها تفتقر لمعرّف الكيان.
 */
export const broadcastNotificationSchema = z
  .object({
    audience: z.enum(['ALL', 'CUSTOMERS', 'PROVIDERS']),
    type: z.enum(['PROMOTION', 'SYSTEM']),
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(3).max(400),
    actionUrl: z
      .string()
      .trim()
      .max(200)
      .regex(/^\/[\w\-/?=&%.]*$/, 'رابط الإجراء يجب أن يكون مسارًا داخليًا.')
      .optional(),
  })
  .strict();

export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;

/* ================================================================== */
/* الإعدادات العامة                                                    */
/* ================================================================== */

export const upsertSettingSchema = z
  .object({
    key: z.string().trim().min(2).max(80),
    // قيمة حرة (JSON) — النطاق يبقى نصًا/رقمًا/بوليان لتفادي تعقيد لا داعي له
    value: z.union([z.string().max(1000), z.number(), z.boolean()]),
    description: safeString(300).optional(),
  })
  .strict();

export type UpsertSettingInput = z.infer<typeof upsertSettingSchema>;

/* ================================================================== */
/* سجل التدقيق                                                         */
/* ================================================================== */

export const listAuditLogsQuerySchema = paginationSchema
  .extend({
    entityType: safeString(40).optional(),
    action: safeString(60).optional(),
  })
  .strict();

/* ================================================================== */
/* المعرّفات المشتركة                                                   */
/* ================================================================== */

export const userIdParamSchema = z.object({ id: objectIdSchema }).strict();
export const categoryIdParamSchema = z.object({ id: objectIdSchema }).strict();
export const adminProfessionIdParamSchema = z.object({ id: objectIdSchema }).strict();
export const adminServiceIdParamSchema = z.object({ id: objectIdSchema }).strict();
export const adminReviewIdParamSchema = z.object({ id: objectIdSchema }).strict();
export const adminOrderIdParamSchema = z.object({ id: objectIdSchema }).strict();

// إعادة تصدير — يمنع استيراد NOTIFICATION_TYPES في مكانين مختلفين لو احتاجته الواجهة لاحقًا
export { NOTIFICATION_TYPES };
