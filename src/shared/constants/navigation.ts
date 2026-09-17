import type { LucideIcon } from 'lucide-react';
import { Bell, Grid2x2, Heart, Home, User, UserRound, Wrench } from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Bottom Navigation للعميل — الترتيب من الصور 06، 08، 09، 13، 14، 15، 16.
 *
 * مهم: المصفوفة مكتوبة بترتيب **القراءة العربية من اليمين لليسار**:
 * التصنيفات (أقصى اليمين) · الإشعارات · الرئيسية (الوسط) · المفضلة · حسابي (أقصى اليسار).
 * الحاوية `dir="rtl"` تتكفّل بالعرض، فالعنصر الأول يظهر يمينًا.
 */
export const CUSTOMER_NAV: readonly NavItem[] = [
  { key: 'categories', label: 'التصنيفات', href: '/categories', icon: Grid2x2 },
  { key: 'notifications', label: 'الإشعارات', href: '/notifications', icon: Bell },
  { key: 'home', label: 'الرئيسية', href: '/home', icon: Home },
  { key: 'favorites', label: 'المفضلة', href: '/account/favorites', icon: Heart },
  { key: 'account', label: 'حسابي', href: '/account', icon: User },
];

/**
 * Bottom Navigation لمقدم الخدمة — الترتيب من الصور 24–29.
 * الإشعارات (أقصى اليمين) · خدماتي · الرئيسية (الوسط) · ملفي · حسابي.
 *
 * لا طلبات ولا مراسلة داخل التطبيق — التواصل مباشر بالهاتف أو واتساب.
 */
export const PROVIDER_NAV: readonly NavItem[] = [
  { key: 'notifications', label: 'الإشعارات', href: '/provider/notifications', icon: Bell },
  { key: 'services', label: 'خدماتي', href: '/provider/services', icon: Wrench },
  { key: 'dashboard', label: 'الرئيسية', href: '/provider/dashboard', icon: Home },
  { key: 'profile', label: 'ملفي', href: '/provider/profile', icon: UserRound },
  { key: 'account', label: 'حسابي', href: '/provider/account', icon: User },
];

/** فهرس العنصر الأوسط — يُعرض بأيقونة ممتلئة داخل دائرة زرقاء (الصورة 06). */
export const NAV_CENTER_INDEX = 2;
