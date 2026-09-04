import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  ClipboardList,
  Grid2x2,
  Home,
  MessageSquare,
  User,
} from 'lucide-react';

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
 * التصنيفات (أقصى اليمين) · الإشعارات · الرئيسية (الوسط) · طلباتي · حسابي (أقصى اليسار).
 * الحاوية `dir="rtl"` تتكفّل بالعرض، فالعنصر الأول يظهر يمينًا.
 */
export const CUSTOMER_NAV: readonly NavItem[] = [
  { key: 'categories', label: 'التصنيفات', href: '/categories', icon: Grid2x2 },
  { key: 'notifications', label: 'الإشعارات', href: '/notifications', icon: Bell },
  { key: 'home', label: 'الرئيسية', href: '/home', icon: Home },
  { key: 'orders', label: 'طلباتي', href: '/orders', icon: ClipboardList },
  { key: 'account', label: 'حسابي', href: '/account', icon: User },
];

/**
 * Bottom Navigation لمقدم الخدمة — الترتيب من الصور 24–29.
 * الإشعارات (أقصى اليمين) · طلباتي · الرئيسية (الوسط) · الرسائل · حسابي.
 *
 * الفرق عن العميل: «التصنيفات» تُستبدل بـ«الرسائل»، وتنتقل «الإشعارات» لأقصى اليمين.
 */
export const PROVIDER_NAV: readonly NavItem[] = [
  { key: 'notifications', label: 'الإشعارات', href: '/provider/notifications', icon: Bell },
  { key: 'orders', label: 'طلباتي', href: '/provider/orders', icon: ClipboardList },
  { key: 'dashboard', label: 'الرئيسية', href: '/provider/dashboard', icon: Home },
  { key: 'messages', label: 'الرسائل', href: '/provider/messages', icon: MessageSquare },
  { key: 'account', label: 'حسابي', href: '/provider/account', icon: User },
];

/** فهرس العنصر الأوسط — يُعرض بأيقونة ممتلئة داخل دائرة زرقاء (الصورة 06). */
export const NAV_CENTER_INDEX = 2;
