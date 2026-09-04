'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  BadgeCheck,
  Bell,
  ClipboardList,
  FileClock,
  Grid2x2,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wrench,
} from 'lucide-react';
import { AppHeader } from './app-header';
import { PageContainer } from './page-container';
import { cn } from '@/lib/cn';

/**
 * الهيكل المشترك لكل شاشات الإدارة (Phase 10) — لا صورة مرجعية لها؛
 * شاشة مشتقّة مبرَّرة بحاجة أي نظام إدارة لمساحة تنقّل بين أقسامه
 * (UI_ANALYSIS §0.1)، مبنية بنفس نظام التصميم المعتمد في بقية التطبيق.
 *
 * على الموبايل: شريط تبويبات أفقي قابل للتمرير تحت الترويسة، بنفس نمط
 * `scroll-x` المستخدم في شاشات الفلاتر (الصورة 09).
 */

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/admin/providers', label: 'توثيق المزوّدين', icon: ShieldCheck },
  { href: '/admin/users', label: 'المستخدمون', icon: Users },
  { href: '/admin/categories', label: 'التصنيفات', icon: Grid2x2 },
  { href: '/admin/professions', label: 'المهن والمستندات', icon: Wrench },
  { href: '/admin/services', label: 'الخدمات', icon: ShoppingBag },
  { href: '/admin/orders', label: 'الطلبات', icon: ClipboardList },
  { href: '/admin/reviews', label: 'التقييمات', icon: BadgeCheck },
  { href: '/admin/notifications', label: 'الإشعارات العامة', icon: Bell },
  { href: '/admin/settings', label: 'الإعدادات', icon: Settings },
  { href: '/admin/audit-logs', label: 'سجل التدقيق', icon: FileClock },
] as const;

export interface AdminShellProps {
  children: ReactNode;
  /** يُظهر تنبيهًا أعلى المحتوى — مثل عدد طلبات التوثيق المعلّقة. */
  banner?: ReactNode;
}

export function AdminShell({ children, banner }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <>
      <AppHeader notificationsHref="/admin/notifications" locationLabel="لوحة الإدارة" />

      <nav
        aria-label="أقسام لوحة الإدارة"
        className="scroll-x sticky top-[var(--spacing-header)] z-20 flex gap-2 border-b border-border bg-surface px-page py-2"
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-2 text-badge font-semibold transition-colors',
                active
                  ? 'bg-brand-600 text-white'
                  : 'border border-border bg-surface text-ink-600 hover:bg-brand-50'
              )}
            >
              <Icon size={14} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <PageContainer withBottomNav={false} className="flex flex-col gap-4 pb-10 pt-4">
        {banner}
        {children}
      </PageContainer>
    </>
  );
}

export interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/** ترويسة قسم إداري — عنوان + وصف + إجراء اختياري (زر إضافة مثلًا). */
export function AdminPageHeader({ title, subtitle, action }: AdminPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-section font-extrabold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-meta text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

