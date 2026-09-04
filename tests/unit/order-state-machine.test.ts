import { describe, expect, it } from 'vitest';
import {
  allowedTransitions,
  assertTransition,
  canCustomerCancel,
  canReview,
  checkTransition,
  findTransition,
  isTerminal,
  TERMINAL_STATUSES,
  TIMELINE_ORDER,
  TRANSITIONS,
} from '@/server/policies/order-state-machine';
import { completeOrderSchema } from '@/shared/schemas/order.schema';
import { assertCompletionConfirmed } from '@/server/services/provider-orders.service';
import { ORDER_STATUSES, type OrderStatus } from '@/shared/constants/order-status';
import { USER_ROLES, type UserRole } from '@/shared/constants/roles';

/**
 * جدول الانتقالات كاملًا — المسموح **والممنوع**.
 *
 * الاختبار الحاسم هنا هو الأخير: يمرّ على كل تركيبة ممكنة
 * (7 حالات × 7 حالات × 3 أدوار = 147) ويتأكد أن ما ليس في الجدول مرفوض.
 * بهذا لا تمرّ أي ثغرة انتقال بالسهو مهما أُضيف من حالات لاحقًا.
 */

/* ================================================================== */
/* الانتقالات المسموحة — واحدًا واحدًا                                  */
/* ================================================================== */

describe('الانتقالات المسموحة', () => {
  const allowed: [OrderStatus, OrderStatus, UserRole][] = [
    ['NEW', 'ACCEPTED', 'PROVIDER'],
    ['NEW', 'REJECTED', 'PROVIDER'],
    ['NEW', 'CANCELLED', 'CUSTOMER'],
    ['NEW', 'CANCELLED', 'ADMIN'],
    ['ACCEPTED', 'IN_PROGRESS', 'PROVIDER'],
    ['ACCEPTED', 'ON_THE_WAY', 'PROVIDER'],
    ['ACCEPTED', 'CANCELLED', 'CUSTOMER'],
    ['ACCEPTED', 'CANCELLED', 'ADMIN'],
    ['IN_PROGRESS', 'ON_THE_WAY', 'PROVIDER'],
    ['ON_THE_WAY', 'IN_PROGRESS', 'PROVIDER'],
  ];

  it.each(allowed)('%s ← %s بواسطة %s', (from, to, role) => {
    expect(checkTransition({ from, to, role }).allowed).toBe(true);
  });

  it('الإكمال مسموح من IN_PROGRESS و ON_THE_WAY بتأكيد الكاش', () => {
    for (const from of ['IN_PROGRESS', 'ON_THE_WAY'] as const) {
      expect(
        checkTransition({ from, to: 'COMPLETED', role: 'PROVIDER', cashReceivedConfirmed: true })
          .allowed
      ).toBe(true);
    }
  });
});

/* ================================================================== */
/* شرط تأكيد استلام المبلغ                                             */
/* ================================================================== */

describe('الإكمال مشروط بتأكيد استلام المبلغ', () => {
  it('يُرفض بلا تأكيد', () => {
    const result = checkTransition({ from: 'IN_PROGRESS', to: 'COMPLETED', role: 'PROVIDER' });
    expect(result).toEqual({ allowed: false, reason: 'CASH_REQUIRED' });
  });

  it('يُرفض عند تأكيد صريح بالنفي', () => {
    const result = checkTransition({
      from: 'ON_THE_WAY',
      to: 'COMPLETED',
      role: 'PROVIDER',
      cashReceivedConfirmed: false,
    });
    expect(result).toEqual({ allowed: false, reason: 'CASH_REQUIRED' });
  });

  it('يرمي 409 برسالة عربية واضحة', () => {
    expect(() =>
      assertTransition({ from: 'IN_PROGRESS', to: 'COMPLETED', role: 'PROVIDER' })
    ).toThrowError(/تأكيد استلام المبلغ/);
  });

  it('تأكيد الكاش لا يفتح انتقالًا غير مسموح أصلًا', () => {
    // من NEW مباشرة إلى COMPLETED مرفوض مهما كان الكاش مؤكّدًا
    expect(
      checkTransition({
        from: 'NEW',
        to: 'COMPLETED',
        role: 'PROVIDER',
        cashReceivedConfirmed: true,
      }).allowed
    ).toBe(false);
  });
});

/* ================================================================== */
/* الإلغاء                                                             */
/* ================================================================== */

describe('قواعد الإلغاء', () => {
  it('العميل يلغي في NEW و ACCEPTED فقط', () => {
    expect(canCustomerCancel('NEW')).toBe(true);
    expect(canCustomerCancel('ACCEPTED')).toBe(true);
  });

  it('لا إلغاء بعد بدء التنفيذ — معيار قبول صريح', () => {
    for (const status of ['IN_PROGRESS', 'ON_THE_WAY', 'COMPLETED'] as const) {
      expect(canCustomerCancel(status), status).toBe(false);
      expect(() => assertTransition({ from: status, to: 'CANCELLED', role: 'CUSTOMER' })).toThrow();
    }
  });

  it('مقدم الخدمة لا يملك الإلغاء — الرفض مساره الوحيد', () => {
    expect(checkTransition({ from: 'NEW', to: 'CANCELLED', role: 'PROVIDER' })).toEqual({
      allowed: false,
      reason: 'ROLE',
    });
  });

  it('رفض الدور يرمي 403 لا 409', () => {
    expect(() => assertTransition({ from: 'NEW', to: 'CANCELLED', role: 'PROVIDER' })).toThrowError(
      /صلاحية/
    );
  });
});

/* ================================================================== */
/* الحالات النهائية                                                    */
/* ================================================================== */

describe('الحالات النهائية', () => {
  it('COMPLETED و REJECTED و CANCELLED نهائية', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(['CANCELLED', 'COMPLETED', 'REJECTED']);
    for (const status of TERMINAL_STATUSES) expect(isTerminal(status)).toBe(true);
  });

  it('لا انتقال من حالة نهائية مهما كان الدور والهدف', () => {
    for (const from of TERMINAL_STATUSES) {
      for (const to of ORDER_STATUSES) {
        for (const role of USER_ROLES) {
          if (from === to) continue;
          expect(checkTransition({ from, to, role }).allowed, `${from}→${to} (${role})`).toBe(false);
        }
      }
    }
  });

  it('الحالة النهائية ترمي رسالة تذكر الحالة الحالية', () => {
    expect(() => assertTransition({ from: 'COMPLETED', to: 'CANCELLED', role: 'ADMIN' })).toThrowError(
      /مكتمل/
    );
  });

  it('لا انتقال من حالة إلى نفسها', () => {
    for (const status of ORDER_STATUSES) {
      for (const role of USER_ROLES) {
        expect(checkTransition({ from: status, to: status, role }).allowed).toBe(false);
      }
    }
  });

  it('إعادة الإجراء على حالة نهائية تُنسب لكونها نهائية لا لتطابق الطرفين', () => {
    // «إلغاء طلب ملغى» يجب أن يقول «الطلب ملغي» لا «من ملغي إلى ملغي»
    expect(checkTransition({ from: 'CANCELLED', to: 'CANCELLED', role: 'CUSTOMER' })).toEqual({
      allowed: false,
      reason: 'TERMINAL',
    });
    expect(() =>
      assertTransition({ from: 'CANCELLED', to: 'CANCELLED', role: 'CUSTOMER' })
    ).toThrowError(/الطلب في حالة «ملغي»/);
  });
});

/* ================================================================== */
/* الفحص الشامل — كل التركيبات                                         */
/* ================================================================== */

describe('الجدول مغلق — كل ما ليس فيه ممنوع', () => {
  it('147 تركيبة: المسموح فقط ما ورد في TRANSITIONS', () => {
    let allowedCount = 0;
    let deniedCount = 0;

    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        for (const role of USER_ROLES) {
          const inTable = TRANSITIONS.some(
            (entry) => entry.from === from && entry.to === to && entry.roles.includes(role)
          );

          const result = checkTransition({
            from,
            to,
            role,
            // نمنح التأكيد دائمًا حتى لا يكون سبب الرفض هو الكاش
            cashReceivedConfirmed: true,
          });

          expect(result.allowed, `${from} → ${to} بواسطة ${role}`).toBe(inTable);
          if (result.allowed) allowedCount += 1;
          else deniedCount += 1;
        }
      }
    }

    expect(allowedCount + deniedCount).toBe(
      ORDER_STATUSES.length * ORDER_STATUSES.length * USER_ROLES.length
    );
    // 12 انتقالًا مسموحًا: 10 بسيطة + إكمالان
    expect(allowedCount).toBe(12);
  });

  it('لا يوجد انتقال مكرّر في الجدول', () => {
    const keys = TRANSITIONS.map((entry) => `${entry.from}->${entry.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('لا انتقال يخرج من حالة نهائية في الجدول نفسه', () => {
    for (const entry of TRANSITIONS) {
      expect(TERMINAL_STATUSES).not.toContain(entry.from);
    }
  });

  it('العميل لا يملك أي انتقال غير الإلغاء', () => {
    const customerTargets = new Set(
      TRANSITIONS.filter((entry) => entry.roles.includes('CUSTOMER')).map((entry) => entry.to)
    );
    expect([...customerTargets]).toEqual(['CANCELLED']);
  });

  it('تقدّم التنفيذ حكر على مقدم الخدمة', () => {
    for (const to of ['ACCEPTED', 'IN_PROGRESS', 'ON_THE_WAY', 'COMPLETED', 'REJECTED'] as const) {
      const entries = TRANSITIONS.filter((entry) => entry.to === to);
      for (const entry of entries) {
        expect(entry.roles, `${entry.from}→${to}`).toEqual(['PROVIDER']);
      }
    }
  });
});

/* ================================================================== */
/* أدوات مساعدة                                                        */
/* ================================================================== */

describe('allowedTransitions', () => {
  it('تعطي الواجهة ما تعرضه من أزرار', () => {
    expect(allowedTransitions('NEW', 'PROVIDER').sort()).toEqual(['ACCEPTED', 'REJECTED']);
    expect(allowedTransitions('NEW', 'CUSTOMER')).toEqual(['CANCELLED']);
    expect(allowedTransitions('COMPLETED', 'PROVIDER')).toEqual([]);
  });

  it('findTransition تجد التعريف بغضّ النظر عن الدور', () => {
    expect(findTransition('NEW', 'ACCEPTED')?.roles).toEqual(['PROVIDER']);
    expect(findTransition('NEW', 'COMPLETED')).toBeUndefined();
  });
});

describe('قواعد العرض', () => {
  it('التقييم بعد الإكمال فقط', () => {
    for (const status of ORDER_STATUSES) {
      expect(canReview(status), status).toBe(status === 'COMPLETED');
    }
  });

  it('كل حالة لها موضع في الخط الزمني', () => {
    for (const status of ORDER_STATUSES) {
      expect(TIMELINE_ORDER[status]).toBeTypeOf('number');
    }
  });

  it('التنفيذ الجاري و«في الطريق» في نفس المرتبة — أربع نقاط لا خمس', () => {
    expect(TIMELINE_ORDER.IN_PROGRESS).toBe(TIMELINE_ORDER.ON_THE_WAY);
    expect(new Set(Object.values(TIMELINE_ORDER)).size).toBe(4);
  });
});

/* ================================================================== */
/* رسائل التأكيد بالعربية في كل الحالات                                 */
/* ================================================================== */

describe('حارس تأكيد الإكمال', () => {
  /** يلتقط الرمز والرسالة من الخطأ المرمي. */
  function capture(input: { serviceCompleted?: boolean; cashReceivedConfirmed?: boolean }) {
    try {
      assertCompletionConfirmed(input);
      return { status: 200, message: '' };
    } catch (error) {
      return {
        status: (error as { httpStatus: number }).httpStatus,
        message: (error as { userMessage: string }).userMessage,
      };
    }
  }

  it('يمرّ بالتأكيد الكامل', () => {
    expect(() =>
      assertCompletionConfirmed({ serviceCompleted: true, cashReceivedConfirmed: true })
    ).not.toThrow();
  });

  it('يرمي 422 لا 400 عند غياب تأكيد استلام المبلغ — معيار قبول صريح', () => {
    /*
     * غياب التأكيد مخالفة **قاعدة عمل** لا خطأ شكل، فالرمز 422 كما ينصّ
     * PROJECT_PLAN — Phase 8 حرفيًا.
     */
    for (const input of [
      {},
      { serviceCompleted: true },
      { serviceCompleted: true, cashReceivedConfirmed: false },
    ]) {
      const result = capture(input);
      expect(result.status, JSON.stringify(input)).toBe(422);
      // الرسالة عربية بالكامل — لا تسريب لنص المكتبة
      expect(result.message).not.toMatch(/[A-Za-z]{4,}/);
    }
  });

  it('رسالة تأكيد المبلغ تذكر سببها صراحةً', () => {
    expect(capture({ serviceCompleted: true }).message).toContain('استلام المبلغ');
  });

  it('يرمي 422 عند غياب تأكيد إتمام الخدمة', () => {
    const result = capture({ cashReceivedConfirmed: true });
    expect(result.status).toBe(422);
    expect(result.message).not.toMatch(/[A-Za-z]{4,}/);
  });

  it('المخطط يتحقق من الشكل ويترك القاعدة للحارس', () => {
    // شكل صحيح بلا تأكيد — يمرّ من المخطط ويسقط عند الحارس بـ422
    expect(completeOrderSchema.safeParse({ cashReceivedConfirmed: false }).success).toBe(true);
    // شكل خاطئ — يسقط عند المخطط نفسه بـ400
    expect(completeOrderSchema.safeParse({ cashReceivedConfirmed: 'yes' }).success).toBe(false);
  });
});
