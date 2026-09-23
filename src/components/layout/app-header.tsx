import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bell, MapPin } from 'lucide-react';
import { AutoBackButton } from './back-header';
import { BrandMark } from './brand-mark';
import { NotificationDot } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { GOVERNORATE } from '@/shared/constants/fayoum-areas';

export interface AppHeaderProps {
  /**
   * اسم المحافظة/المنطقة المعروض يمين الهيدر.
   * نص فقط — ليس منتقي خريطة (ARCHITECTURE §0.2).
   */
  locationLabel?: string;
  notificationCount?: number;
  notificationsHref?: string;
  /** يستبدل الجانب الأيمن — يُستخدم لبطاقة المزوّد في الصور 24–29. */
  start?: ReactNode;
  className?: string;
}

/**
 * ترويسة التطبيق — الصور 06، 07، 08، 15، 16، 24.
 *
 * التخطيط: [رجوع + منتقي المنطقة النصي] — [العلامة] — [الجرس]
 * في RTL يظهر الأول يمينًا والأخير يسارًا. زر الرجوع يختفي في الشاشات
 * الجذرية كالرئيسية (`ROOT_PATHS`).
 */
export function AppHeader({
  locationLabel = GOVERNORATE,
  notificationCount,
  notificationsHref = '/notifications',
  start,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border',
        'bg-surface/95 px-page pt-safe pb-3 backdrop-blur-sm',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <AutoBackButton />
        {start ?? (
          <span className="flex min-w-0 items-center gap-1 text-label font-semibold text-ink-900">
            <MapPin size={18} className="shrink-0 text-brand-600" aria-hidden="true" />
            <span className="truncate">{locationLabel}</span>
          </span>
        )}
      </div>

      <BrandMark priority />

      <div className="flex flex-1 items-center justify-end">
        <Link
          href={notificationsHref}
          aria-label={
            notificationCount ? `الإشعارات، ${notificationCount} غير مقروء` : 'الإشعارات'
          }
          className="relative rounded-field p-2 text-brand-600 transition-colors hover:bg-brand-50"
        >
          <Bell size={24} />
          <NotificationDot count={notificationCount} />
        </Link>
      </div>
    </header>
  );
}
