'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationDot } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { CUSTOMER_NAV, PROVIDER_NAV, type NavItem } from '@/shared/constants/navigation';

export interface BottomNavProps {
  variant?: 'customer' | 'provider';
  /** عدّادات الشارات الحمراء مفهرسة بـ `key` العنصر. */
  badges?: Partial<Record<string, number>>;
  className?: string;
}

/**
 * شريط التنقّل السفلي — كل الشاشات الداخلية.
 *
 * الترتيب يأتي من `navigation.ts` بترتيب القراءة العربية (العنصر الأول يمينًا).
 *
 * التبويب النشط بأيقونة **ممتلئة** ونص عريض — عُرف iOS وأندرويد. الدائرة
 * الزرقاء المرفوعة للعنصر الأوسط (الصورة 06) أُزيلت بقرار صريح: كانت تظهر
 * مع التنشيط فقط، فيهتز الشريط عند كل تنقّل.
 */
export function BottomNav({ variant = 'customer', badges, className }: BottomNavProps) {
  const pathname = usePathname();
  const items = variant === 'provider' ? PROVIDER_NAV : CUSTOMER_NAV;

  return (
    <nav
      aria-label="التنقل الرئيسي"
      // ثابت أثناء حركة الانتقال بين الشاشات — انظر globals.css
      style={{ viewTransitionName: 'bottom-nav' }}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-safe backdrop-blur-md',
        className
      )}
    >
      <ul className="flex h-nav items-stretch" style={{ height: 'var(--spacing-nav)' }}>
        {items.map((item) => (
          <NavLink
            key={item.key}
            item={item}
            active={isActive(pathname, item.href)}
            badge={badges?.[item.key]}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const Icon = item.icon;

  return (
    <li className="flex-1">
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className="pressable flex h-full flex-col items-center justify-center gap-1 px-1"
      >
        <span
          className={cn(
            'relative flex items-center justify-center transition-colors',
            active ? 'text-brand-600' : 'text-ink-400'
          )}
        >
          <Icon
            size={24}
            fill={active ? 'currentColor' : 'none'}
            strokeWidth={active ? 1.75 : 2}
            aria-hidden="true"
          />
          <NotificationDot count={badge} />
        </span>

        <span
          className={cn(
            'text-badge leading-none',
            active ? 'font-bold text-brand-600' : 'text-ink-400'
          )}
        >
          {item.label}
        </span>
      </Link>
    </li>
  );
}

/** العنصر نشط إذا طابق المسار تمامًا أو كان المسار الحالي فرعًا منه. */
export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
