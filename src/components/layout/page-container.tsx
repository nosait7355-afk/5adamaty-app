import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageContainerProps {
  children: ReactNode;
  /** يضيف حشوًا سفليًا يساوي ارتفاع Bottom Nav حتى لا يغطّي آخر عنصر. */
  withBottomNav?: boolean;
  className?: string;
}

/**
 * حاوية الصفحة.
 *
 * Mobile-first: العرض الأقصى 520px ومتمركزة — على الشاشات الأكبر (تابلت/ويب)
 * تبقى بعمود واحد كما في التصميم، بلا أي تخطيط سطح مكتب.
 */
export function PageContainer({ children, withBottomNav = true, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[520px] px-page',
        withBottomNav && 'pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom,0px)+1rem)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export interface PageTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

/**
 * عنوان الشاشة الوسطي — 28px/800 مع وصف رمادي تحته.
 * نمط ثابت في الصور 07، 08، 09، 13، 15، 17، 18، 19–23، 25.
 */
export function PageTitle({ title, subtitle, className }: PageTitleProps) {
  return (
    <div className={cn('py-4 text-center', className)}>
      <h1 className="text-screen-title font-extrabold text-ink-900">{title}</h1>
      {subtitle && <p className="mt-1 text-body text-ink-400">{subtitle}</p>}
    </div>
  );
}
