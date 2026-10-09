/**
 * سجلّ الطبقات المفتوحة (Bottom Sheet وأخواتها) بترتيب فتحها.
 *
 * زر الرجوع في أندرويد يُغلق الطبقة العليا أولًا ولا يغادر الصفحة — سلوك
 * كل التطبيقات الأصلية. `NativeBridge` يسأل هنا قبل أن يرجع خطوة في السجل.
 * الويب لا يحتاجه: الحوار الأصلي (`<dialog>`) يُغلق بـEsc وحده.
 */

const stack: (() => void)[] = [];

/** يسجّل طبقة مفتوحة ويعيد دالة إلغاء تسجيلها (تُستدعى عند إغلاقها). */
export function pushOverlay(close: () => void): () => void {
  stack.push(close);
  return () => {
    const index = stack.lastIndexOf(close);
    if (index !== -1) stack.splice(index, 1);
  };
}

/** يغلق الطبقة العليا إن وُجدت، ويعيد `true` إن أغلق شيئًا. */
export function closeTopOverlay(): boolean {
  const close = stack[stack.length - 1];
  if (!close) return false;
  close();
  return true;
}
