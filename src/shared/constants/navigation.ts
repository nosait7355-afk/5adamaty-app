import type { LucideIcon } from 'lucide-react';
import { Heart, Home, LayoutGrid, User, UserRound, Wrench } from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Bottom Navigation للعميل.
 *
 * مهم: المصفوفة مكتوبة بترتيب **القراءة العربية من اليمين لليسار**:
 * الرئيسية (أقصى اليمين) · التصنيفات · المفضلة · حسابي (أقصى اليسار).
 * الحاوية `dir="rtl"` تتكفّل بالعرض، فالعنصر الأول يظهر يمينًا.
 *
 * «الإشعارات» ليست تبويبًا بقرار صريح: تكرّر جرس الترويسة (مع عدّاده)،
 * وأربعة تبويبات أوضح من خمسة. «الرئيسية» أولًا كعُرف التطبيقات الكبرى.
 */
export const CUSTOMER_NAV: readonly NavItem[] = [
  { key: 'home', label: 'الرئيسية', href: '/home', icon: Home },
  { key: 'categories', label: 'التصنيفات', href: '/categories', icon: LayoutGrid },
  { key: 'favorites', label: 'المفضلة', href: '/account/favorites', icon: Heart },
  { key: 'account', label: 'حسابي', href: '/account', icon: User },
];

/**
 * Bottom Navigation لمقدم الخدمة.
 * الرئيسية (أقصى اليمين) · خدماتي · ملفي · حسابي.
 *
 * لا طلبات ولا مراسلة داخل التطبيق — التواصل مباشر بالهاتف أو واتساب.
 * الإشعارات من جرس ترويسة الرئيسية (`/provider/notifications`).
 *
 * "الرئيسية" تفتح نفس صفحة تصفّح الخدمات التي يستخدمها العميل (`/home`):
 * مقدم الخدمة عميل محتمل أيضًا ويحتاج طلب خدمة من مقدم خدمة آخر. مؤشرات
 * حسابه (التقييم، اكتمال الملف) انتقلت إلى أعلى تبويب "ملفي".
 */
export const PROVIDER_NAV: readonly NavItem[] = [
  { key: 'home', label: 'الرئيسية', href: '/home', icon: Home },
  { key: 'services', label: 'خدماتي', href: '/provider/services', icon: Wrench },
  { key: 'profile', label: 'ملفي', href: '/provider/profile', icon: UserRound },
  { key: 'account', label: 'حسابي', href: '/provider/account', icon: User },
];
