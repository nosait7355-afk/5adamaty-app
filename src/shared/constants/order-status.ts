/**
 * حالات الطلب — State Machine (ARCHITECTURE §4).
 * جدول الانتقالات نفسه يُنفَّذ في Phase 7 داخل `src/server/policies/order-state-machine.ts`.
 *
 * ملاحظة: `ON_THE_WAY` علامة حالة يدوية يضغطها المزوّد فقط.
 * لا GPS ولا ETA ولا مسار ولا مسافة (ARCHITECTURE §0.2).
 */
export const ORDER_STATUSES = [
  'NEW',
  'ACCEPTED',
  'IN_PROGRESS',
  'ON_THE_WAY',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** التسميات العربية كما تظهر حرفيًا في الصور 13، 14، 25–29. */
export const ORDER_STATUS_LABELS_AR: Record<OrderStatus, string> = {
  NEW: 'جديد',
  ACCEPTED: 'تم القبول',
  IN_PROGRESS: 'قيد التنفيذ',
  ON_THE_WAY: 'في الطريق',
  COMPLETED: 'مكتمل',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغي',
};

/** لون الـStatusBadge لكل حالة — مطابق لألوان الصور (UI_ANALYSIS §1.4). */
export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  NEW: 'brand',
  ACCEPTED: 'brand',
  IN_PROGRESS: 'warning',
  ON_THE_WAY: 'purple',
  COMPLETED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'danger',
};

export type StatusTone = 'brand' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral';

/**
 * طريقة الدفع — قيمة واحدة ثابتة، لا غير.
 * NON-NEGOTIABLE (ARCHITECTURE §0.1): لا دفع إلكتروني، لا بوابات، لا معاملات.
 * الدفع يتم مباشرة بين العميل ومقدم الخدمة خارج التطبيق.
 */
export const PAYMENT_METHOD = 'CASH_ON_DELIVERY_OFFLINE' as const;
export type PaymentMethod = typeof PAYMENT_METHOD;

export const PAYMENT_METHOD_LABEL_AR = 'كاش (دفع مباشر بينكما)';
export const PAYMENT_NOTICE_AR =
  'لا يوجد دفع أونلاين في تطبيق خدماتي الفيوم. يتم الدفع مباشرة بينك وبين العميل خارج التطبيق.';
