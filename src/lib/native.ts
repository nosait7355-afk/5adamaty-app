/**
 * لمسات أصلية للتطبيق (المرحلة 5): اهتزاز خفيف وقائمة المشاركة.
 *
 * التطبيق يفتح الموقع المنشور، فهذه الشيفرة تصل لكل نسخ أندرويد المثبّتة
 * فورًا — لكن الإضافتين (`@capacitor/haptics` و`@capacitor/share`) جزء من
 * الغلاف الأصلي ولا توجدان إلا في نسخة المتجر التالية. لذلك كل دالة تسأل
 * أولًا `isPluginAvailable`: في النسخ الأقدم وفي المتصفح لا يحدث شيء
 * (الاهتزاز) أو تُستخدم بدائل الويب (المشاركة). لا شيء هنا يرمي خطأً.
 *
 * الاستيراد ديناميكي: الإضافات لا تدخل حزمة الصفحة إلا حين تُستخدم.
 */

async function nativePlugin(name: 'Haptics' | 'Share'): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(name);
  } catch {
    return false;
  }
}

export type HapticKind =
  /** لمسة خفيفة: تبديل (القلب)، اختيار تبويب. */
  | 'light'
  /** أثقل قليلًا: إطلاق «اسحب لتحديث». */
  | 'medium'
  /** تنبيه قبل إجراء لا رجعة فيه: تأكيد الحذف. */
  | 'warning'
  /** نجاح: اكتمال عملية. */
  | 'success';

/**
 * اهتزاز قصير يؤكّد أن اللمسة وصلت — نفس إحساس أزرار iOS وأندرويد.
 * لا يُنتظر (`void haptic(...)`): التأخير في الاهتزاز أسوأ من غيابه.
 */
export async function haptic(kind: HapticKind = 'light'): Promise<void> {
  if (!(await nativePlugin('Haptics'))) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (kind === 'light') await Haptics.impact({ style: ImpactStyle.Light });
    else if (kind === 'medium') await Haptics.impact({ style: ImpactStyle.Medium });
    else
      await Haptics.notification({
        type: kind === 'warning' ? NotificationType.Warning : NotificationType.Success,
      });
  } catch {
    // جهاز بلا محرّك اهتزاز أو أذونات — لا شيء يستحق إزعاج المستخدم
  }
}

export interface ShareContent {
  title?: string | undefined;
  text?: string | undefined;
  url: string;
}

/** ما حدث فعلًا — كي تعرض الواجهة الرسالة الصحيحة (أو لا رسالة). */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * قائمة المشاركة الأصلية للنظام، بالترتيب:
 *   1. إضافة Capacitor (نسخة المتجر الجديدة) — WebView أندرويد لا يدعم Web Share.
 *   2. Web Share في المتصفح (كروم أندرويد، سفاري).
 *   3. نسخ الرابط حين لا يوجد أي منهما.
 */
export async function shareLink(content: ShareContent): Promise<ShareResult> {
  if (await nativePlugin('Share')) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        ...(content.title ? { title: content.title, dialogTitle: content.title } : {}),
        ...(content.text ? { text: content.text } : {}),
        url: content.url,
      });
      return 'shared';
    } catch {
      // إغلاق القائمة بلا اختيار يصل هنا أيضًا — ليس فشلًا يستحق رسالة
      return 'cancelled';
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        ...(content.title ? { title: content.title } : {}),
        ...(content.text ? { text: content.text } : {}),
        url: content.url,
      });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }

  try {
    await navigator.clipboard.writeText(content.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
