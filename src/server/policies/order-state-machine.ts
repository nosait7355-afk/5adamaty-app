import { forbidden, invalidTransition } from '@/server/lib/errors';
import { ORDER_STATUS_LABELS_AR, type OrderStatus } from '@/shared/constants/order-status';
import type { UserRole } from '@/shared/constants/roles';

/**
 * State Machine للطلبات (ARCHITECTURE §4).
 *
 * هذا الملف هو **المصدر الوحيد** لما يجوز وما لا يجوز في دورة حياة الطلب.
 * لا يعرف شيئًا عن قاعدة البيانات ولا عن HTTP — دوال خالصة تُختبر وحدويًا،
 * ويستدعيها كل مسار يمسّ حالة طلب.
 *
 * ```
 * NEW ──accept(PROVIDER)──▶ ACCEPTED ──start(PROVIDER)──▶ IN_PROGRESS ─┐
 *  │                            │                              │        │
 *  │                            └──onTheWay(PROVIDER)──▶ ON_THE_WAY ────┤
 *  │                                                                    │
 *  │                                  complete(PROVIDER + cashReceived) │
 *  │                                                                    ▼
 *  ├──reject(PROVIDER)──▶ REJECTED                                 COMPLETED
 *  └──cancel(CUSTOMER|ADMIN، في NEW/ACCEPTED فقط)──▶ CANCELLED
 * ```
 */

export interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  /** الأدوار المسموح لها بهذا الانتقال بالضبط. */
  roles: readonly UserRole[];
  /** يشترط تأكيد استلام المبلغ نقدًا قبل التنفيذ. */
  requiresCashConfirmation?: boolean;
}

/**
 * جدول الانتقالات — القائمة الكاملة والوحيدة.
 * أي زوج `(from, to)` غير مذكور هنا مرفوض بـ409، وأي دور غير مذكور مرفوض بـ403.
 */
export const TRANSITIONS: readonly Transition[] = [
  /* ---- قرار المزوّد على طلب جديد ---- */
  { from: 'NEW', to: 'ACCEPTED', roles: ['PROVIDER'] },
  { from: 'NEW', to: 'REJECTED', roles: ['PROVIDER'] },

  /* ---- تقدّم التنفيذ — بيد المزوّد وحده ---- */
  { from: 'ACCEPTED', to: 'IN_PROGRESS', roles: ['PROVIDER'] },
  { from: 'ACCEPTED', to: 'ON_THE_WAY', roles: ['PROVIDER'] },
  { from: 'IN_PROGRESS', to: 'ON_THE_WAY', roles: ['PROVIDER'] },
  { from: 'ON_THE_WAY', to: 'IN_PROGRESS', roles: ['PROVIDER'] },

  /* ---- الإكمال — مشروط بتأكيد استلام المبلغ (الصورتان 28 و29) ---- */
  { from: 'IN_PROGRESS', to: 'COMPLETED', roles: ['PROVIDER'], requiresCashConfirmation: true },
  { from: 'ON_THE_WAY', to: 'COMPLETED', roles: ['PROVIDER'], requiresCashConfirmation: true },

  /*
   * ---- الإلغاء ----
   * مسموح في NEW و ACCEPTED فقط. بعد بدء التنفيذ يكون المزوّد قد تحرّك
   * فعلًا، فالإلغاء من طرف واحد يصير ظلمًا — والقاعدة مفروضة هنا لا في الواجهة.
   */
  { from: 'NEW', to: 'CANCELLED', roles: ['CUSTOMER', 'ADMIN'] },
  { from: 'ACCEPTED', to: 'CANCELLED', roles: ['CUSTOMER', 'ADMIN'] },
];

/** الحالات النهائية — لا انتقال بعدها إطلاقًا. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ['COMPLETED', 'REJECTED', 'CANCELLED'];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** يبحث عن تعريف الانتقال بغضّ النظر عن الدور. */
export function findTransition(from: OrderStatus, to: OrderStatus): Transition | undefined {
  return TRANSITIONS.find((entry) => entry.from === from && entry.to === to);
}

/** كل الحالات التي يمكن لهذا الدور نقل الطلب إليها من حالته الحالية. */
export function allowedTransitions(from: OrderStatus, role: UserRole): OrderStatus[] {
  return TRANSITIONS.filter((entry) => entry.from === from && entry.roles.includes(role)).map(
    (entry) => entry.to
  );
}

export interface TransitionContext {
  from: OrderStatus;
  to: OrderStatus;
  role: UserRole;
  /** حالة علامة استلام المبلغ **بعد** تطبيق هذا الطلب. */
  cashReceivedConfirmed?: boolean;
}

export type TransitionCheck =
  | { allowed: true; transition: Transition }
  | { allowed: false; reason: 'TERMINAL' | 'UNKNOWN_TRANSITION' | 'ROLE' | 'CASH_REQUIRED' };

/**
 * الفحص الخالص — يجيب «هل يجوز؟» بلا أي أثر جانبي.
 * تستخدمه الواجهة لإظهار الأزرار، ويستخدمه الخادم للتنفيذ.
 */
export function checkTransition(context: TransitionContext): TransitionCheck {
  /*
   * فحص الحالة النهائية **قبل** فحص التطابق: إعادة إلغاء طلب ملغى تنتج
   * `from === to`، والرسالة الصحيحة حينها «الطلب في حالة ملغي ولا يمكن
   * تغييرها» لا «لا يمكن نقله من ملغي إلى ملغي».
   */
  if (isTerminal(context.from)) {
    return { allowed: false, reason: 'TERMINAL' };
  }

  if (context.from === context.to) {
    return { allowed: false, reason: 'UNKNOWN_TRANSITION' };
  }

  const transition = findTransition(context.from, context.to);
  if (!transition) {
    return { allowed: false, reason: 'UNKNOWN_TRANSITION' };
  }

  if (!transition.roles.includes(context.role)) {
    return { allowed: false, reason: 'ROLE' };
  }

  if (transition.requiresCashConfirmation && context.cashReceivedConfirmed !== true) {
    return { allowed: false, reason: 'CASH_REQUIRED' };
  }

  return { allowed: true, transition };
}

/**
 * يفرض الانتقال أو يرمي الخطأ المناسب.
 *
 * تمييز الرموز مقصود:
 *   - **403 FORBIDDEN** لمن لا يملك الصلاحية أصلًا.
 *   - **409 INVALID_TRANSITION** لانتقال غير ممكن في هذه الحالة.
 *
 * الرمز `INVALID_TRANSITION` تحديدًا (لا `CONFLICT` العام) منصوص عليه في
 * ARCHITECTURE §4، ليميّز العميل بين «تعارض» و«انتقال مرفوض» بلا قراءة نص.
 */
export function assertTransition(context: TransitionContext): Transition {
  const result = checkTransition(context);
  if (result.allowed) return result.transition;

  const fromLabel = ORDER_STATUS_LABELS_AR[context.from];
  const toLabel = ORDER_STATUS_LABELS_AR[context.to];

  switch (result.reason) {
    case 'ROLE':
      throw forbidden('ليس لديك صلاحية تنفيذ هذا الإجراء على الطلب.');

    case 'TERMINAL':
      throw invalidTransition(`الطلب في حالة «${fromLabel}» ولا يمكن تغييرها.`);

    case 'CASH_REQUIRED':
      throw invalidTransition('لا يمكن إكمال الطلب قبل تأكيد استلام المبلغ من العميل.');

    default:
      throw invalidTransition(`لا يمكن نقل الطلب من «${fromLabel}» إلى «${toLabel}».`);
  }
}

/* ================================================================== */
/* قواعد مشتقّة تستخدمها الواجهة                                       */
/* ================================================================== */

/** هل يستطيع العميل إلغاء الطلب الآن؟ (الصورة 14). */
export function canCustomerCancel(status: OrderStatus): boolean {
  return allowedTransitions(status, 'CUSTOMER').includes('CANCELLED');
}

/** هل يمكن تقييم الطلب؟ التقييم بعد الإكمال فقط (الصورة 13). */
export function canReview(status: OrderStatus): boolean {
  return status === 'COMPLETED';
}

/**
 * ترتيب الحالات في الخط الزمني (الصورة 14).
 *
 * `ON_THE_WAY` و`IN_PROGRESS` في نفس المرتبة: كلاهما «تنفيذ جارٍ»، والتصميم
 * يعرض أربع نقاط لا خمسًا، والانتقال بينهما ذهابًا وإيابًا مسموح.
 */
export const TIMELINE_ORDER: Record<OrderStatus, number> = {
  NEW: 0,
  ACCEPTED: 1,
  IN_PROGRESS: 2,
  ON_THE_WAY: 2,
  COMPLETED: 3,
  REJECTED: 3,
  CANCELLED: 3,
};
