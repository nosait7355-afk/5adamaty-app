'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationDot } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import {
  CUSTOMER_NAV,
  NAV_CENTER_INDEX,
  PROVIDER_NAV,
  type NavItem,
} from '@/shared/constants/navigation';

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
 * العنصر الأوسط «الرئيسية» يُعرض بأيقونة داخل دائرة زرقاء عندما يكون نشطًا
 * (الصورة 06).
 */
export function BottomNav({ variant = 'customer', badges, className }: BottomNavProps) {
  const pathname = usePathname();
  const items = variant === 'provider' ? PROVIDER_NAV : CUSTOMER_NAV;

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface shadow-nav pb-safe',
        className
      )}
    >
      <ul className="flex h-nav items-stretch" style={{ height: 'var(--spacing-nav)' }}>
        {items.map((item, index) => (
          <NavLink
            key={item.key}
            item={item}
            active={isActive(pathname, item.href)}
            emphasized={index === NAV_CENTER_INDEX}
            badge={badges?.[item.key]}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavLink({
  item,
  active,
  emphasized,
  badge,
}: {
  item: NavItem;
  active: boolean;
  emphasized: boolean;
  badge?: number;
}) {
  const Icon = item.icon;

  return (
    <li className="flex-1">
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className="flex h-full flex-col items-center justify-center gap-1 px-1"
      >
        <span
          className={cn(
            'relative flex items-center justify-center transition-colors',
            // العنصر الأوسط النشط: دائرة زرقاء ممتلئة مرفوعة قليلًا (الصورة 06)
            emphasized && active
              ? '-mt-6 size-14 rounded-full bg-brand-600 text-white shadow-brand'
              : active
                ? 'text-brand-600'
                : 'text-ink-400'
          )}
        >
          <Icon size={emphasized && active ? 26 : 24} aria-hidden="true" />
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
