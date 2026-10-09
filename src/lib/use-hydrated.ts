import { useSyncExternalStore } from 'react';

const noop = () => () => undefined;

/**
 * `false` في رسم الخادم وفي أول رسم على الجهاز (الترطيب)، ثم `true`.
 *
 * لما يعرفه الجهاز ولا يعرفه الخادم — مثل اسم المستخدم من جلسة مخزّنة
 * في كاش TanStack: عرضه في الرسم الأول يجعل نص الجهاز مختلفًا عن نص الخادم
 * فيفشل الترطيب ويُعاد بناء الشجرة كلها.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
}
