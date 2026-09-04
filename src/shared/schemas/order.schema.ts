import { z } from 'zod';
import {
  objectIdSchema,
  paginationSchema,
  safeString,
  textAddressSchema,
  timeSchema,
} from './common.schema';
import { ORDER_STATUSES } from '@/shared/constants/order-status';

/**
 * مخططات الطلبات (Phase 7) — الصور 11 إلى 14.
 *
 * ⚠️ ملاحظة مالية NON-NEGOTIABLE: لا يوجد في هذا الملف — ولن يوجد — أي حقل
 * دفع أو بطاقة أو بوابة. `paymentMethod` **لا يُرسله العميل أصلًا**: الخادم
 * يثبّته على القيمة الوحيدة الممكنة. والسعر المعروض يأتي من المزوّد لا من
 * العميل، فلا يستطيع أحد «تسعير» طلبه بنفسه.
 */

/** أقصى عدد صور مرفقة — «يمكنك إضافة حتى 5 صور» في الصورة 11. */
export const MAX_ORDER_ATTACHMENTS = 5;

/**
 * تاريخ الخدمة: إلزامي، بصيغة YYYY-MM-DD، ولا يقبل الماضي.
 * (التاريخ إلزامي والوقت اختياري — مؤكَّد من الصورتين 11 و12.)
 */
const scheduledDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صالحة.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }, 'لا يمكن اختيار تاريخ في الماضي.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00`);
    const limit = new Date();
    limit.setMonth(limit.getMonth() + 6);
    return date <= limit;
  }, 'التاريخ أبعد من ستة أشهر.');

export const createOrderSchema = z
  .object({
    providerId: objectIdSchema,
    /** الخدمة المختارة من ملف المزوّد — اختيارية لأن الطلب قد يكون عامًا. */
    serviceId: objectIdSchema.optional(),

    serviceType: safeString(120).refine((value) => value.length >= 3, {
      message: 'حدّد نوع الخدمة المطلوبة.',
    }),
    // عدّاد 0/500 في الصورة 11
    details: safeString(500).refine((value) => value.length >= 10, {
      message: 'اكتب تفاصيل الطلب في 10 أحرف على الأقل.',
    }),
    notes: safeString(500).optional(),

    /** عنوان نصي بحت من قائمة الفيوم — لا إحداثيات (ARCHITECTURE §0.2). */
    address: textAddressSchema,
    addressId: objectIdSchema.optional(),

    scheduledDate: scheduledDateSchema,
    preferredTimeFrom: timeSchema.optional(),
    preferredTimeTo: timeSchema.optional(),

    /**
     * معرّفات أصول Cloudinary المرفوعة مسبقًا من المتصفح.
     * الخادم يتحقق من كل معرّف لدى Cloudinary قبل حفظه — لا يثق بما يُرسَل.
     */
    attachmentPublicIds: z
      .array(safeString(200))
      .max(MAX_ORDER_ATTACHMENTS, `الحد الأقصى ${MAX_ORDER_ATTACHMENTS} صور.`)
      .default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.preferredTimeTo && !data.preferredTimeFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'حدّد وقت البداية أولًا.',
        path: ['preferredTimeFrom'],
      });
      return;
    }

    if (
      data.preferredTimeFrom &&
      data.preferredTimeTo &&
      data.preferredTimeFrom >= data.preferredTimeTo
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'وقت البداية يجب أن يسبق وقت النهاية.',
        path: ['preferredTimeTo'],
      });
    }
  });

export type CreateOrderInput = z.output<typeof createOrderSchema>;

/* ================================================================== */
/* القوائم — تبويبات الصورة 13                                         */
/* ================================================================== */

/**
 * تبويبات «طلباتي»: الكل / قيد التنفيذ / مكتملة / ملغاة.
 * «قيد التنفيذ» تبويب مركّب يجمع كل الحالات النشطة، و«ملغاة» تضم المرفوض
 * أيضًا — كما هو مرسوم، فالعميل لا يفرّق بينهما عمليًا.
 */
export const ORDER_TABS = ['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

export const ORDER_TAB_LABELS_AR: Record<OrderTab, string> = {
  ALL: 'الكل',
  ACTIVE: 'قيد التنفيذ',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
};

export const ORDER_TAB_STATUSES: Record<OrderTab, readonly (typeof ORDER_STATUSES)[number][]> = {
  ALL: ORDER_STATUSES,
  ACTIVE: ['NEW', 'ACCEPTED', 'IN_PROGRESS', 'ON_THE_WAY'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED', 'REJECTED'],
};

export const listOrdersQuerySchema = paginationSchema
  .extend({
    tab: z.enum(ORDER_TABS).default('ALL'),
    status: z.enum(ORDER_STATUSES).optional(),
  })
  .strict();

export type ListOrdersQuery = z.output<typeof listOrdersQuerySchema>;

export const orderIdParamSchema = z.object({ id: objectIdSchema }).strict();

/* ================================================================== */
/* الإلغاء                                                             */
/* ================================================================== */

export const cancelOrderSchema = z
  .object({
    reason: safeString(300).optional(),
  })
  .strict();

export type CancelOrderInput = z.output<typeof cancelOrderSchema>;

/* ================================================================== */
/* جانب مقدم الخدمة (Phase 8)                                          */
/* ================================================================== */

/**
 * تبويبات «طلباتي» للمزوّد — الستة الظاهرة في الصورة 25.
 * أدقّ من تبويبات العميل: المزوّد يحتاج التمييز بين «قيد التنفيذ» و«في الطريق»
 * لأن إجراءه يختلف بينهما.
 */
export const PROVIDER_ORDER_TABS = [
  'ALL',
  'NEW',
  'IN_PROGRESS',
  'ON_THE_WAY',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ProviderOrderTab = (typeof PROVIDER_ORDER_TABS)[number];

export const PROVIDER_ORDER_TAB_LABELS_AR: Record<ProviderOrderTab, string> = {
  ALL: 'الكل',
  NEW: 'جديد',
  IN_PROGRESS: 'قيد التنفيذ',
  ON_THE_WAY: 'في الطريق',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
};

export const PROVIDER_TAB_STATUSES: Record<
  ProviderOrderTab,
  readonly (typeof ORDER_STATUSES)[number][]
> = {
  ALL: ORDER_STATUSES,
  // «جديد» يضم المقبول أيضًا: كلاهما ينتظر بدء التنفيذ من المزوّد
  NEW: ['NEW', 'ACCEPTED'],
  IN_PROGRESS: ['IN_PROGRESS'],
  ON_THE_WAY: ['ON_THE_WAY'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED', 'REJECTED'],
};

export const PROVIDER_ORDER_SORTS = ['newest', 'oldest', 'price_desc'] as const;
export type ProviderOrderSort = (typeof PROVIDER_ORDER_SORTS)[number];

export const PROVIDER_ORDER_SORT_LABELS_AR: Record<ProviderOrderSort, string> = {
  newest: 'الأحدث',
  oldest: 'الأقدم',
  price_desc: 'الأعلى قيمة',
};

/** بحث برقم الطلب أو اسم العميل — الصورة 25. */
export const listProviderOrdersQuerySchema = paginationSchema
  .extend({
    tab: z.enum(PROVIDER_ORDER_TABS).default('ALL'),
    q: safeString(100).optional(),
    sort: z.enum(PROVIDER_ORDER_SORTS).default('newest'),
  })
  .strict();

export type ListProviderOrdersQuery = z.output<typeof listProviderOrdersQuerySchema>;

/**
 * تحديث حالة الطلب — شبكة الحالات الأربع في الصورة 27.
 *
 * `COMPLETED` **غير مقبولة هنا عمدًا**: الإكمال له مسار خاص يشترط تأكيد
 * استلام المبلغ (`POST /orders/:id/complete`)، فلا يمكن الالتفاف عليه
 * بإرسال الحالة مباشرةً.
 */
export const PROVIDER_STATUS_ACTIONS = ['ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'ON_THE_WAY'] as const;
export type ProviderStatusAction = (typeof PROVIDER_STATUS_ACTIONS)[number];

export const updateOrderStatusSchema = z
  .object({
    status: z.enum(PROVIDER_STATUS_ACTIONS),
    note: safeString(300).optional(),
  })
  .strict()
  .refine((data) => data.status !== 'REJECTED' || Boolean(data.note), {
    message: 'اكتب سبب الرفض — يصل نصّه للعميل.',
    path: ['note'],
  });

export type UpdateOrderStatusInput = z.output<typeof updateOrderStatusSchema>;

/**
 * إكمال الطلب — الصورتان 28 و29.
 *
 * المخطط يتحقق من **الشكل** فقط (قيمة منطقية أو غياب). اشتراط أن تكون
 * `true` قاعدة عمل لا قاعدة شكل، ففُرضت في الخدمة لتعيد **422** لا 400
 * كما ينصّ معيار القبول في PROJECT_PLAN — Phase 8:
 *
 *   - نوع خاطئ (نص بدل منطقي) → 400 من هذا المخطط.
 *   - قيمة `false` أو غياب الحقل → **422** من `assertCompletionConfirmed`.
 *
 * ⚠️ `cashReceivedConfirmed` **علامة حالة فقط** ولا تُنشئ أي سجل مالي
 * (ARCHITECTURE §0.1).
 */
export const completeOrderSchema = z
  .object({
    serviceCompleted: z.boolean().optional(),
    cashReceivedConfirmed: z.boolean().optional(),
    note: safeString(300).optional(),
  })
  .strict();

export type CompleteOrderInput = z.output<typeof completeOrderSchema>;
