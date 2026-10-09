'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { BrandMark } from './brand-mark';
import { cn } from '@/lib/cn';
import { isRootPath, useSafeBack } from '@/lib/navigation-history';
import { usePageTitleStore } from '@/lib/page-title';

export interface BackHeaderProps {
  onBack?: () => void;
  /** إجراء في نهاية الترويسة (يسار في RTL) — زر مشاركة مثلًا. */
  end?: ReactNode;
  className?: string;
}

/**
 * ترويسة الصفحات الداخلية — مضغوطة على طريقة تطبيقات iOS وأندرويد.
 *
 * [رجوع] — [عنوان الصفحة] — [إجراء اختياري]
 *
 * العنوان لا يُكرَّر: `PageTitle` يرسمه كبيرًا أعلى المحتوى، وحين يمرّ تحت
 * الترويسة بالتمرير يظهر هنا صغيرًا (متجر `page-title`). صفحة بلا
 * `PageTitle` تُظهر العلامة في الوسط كما كانت.
 *
 * منتقي المنطقة النصي أُزيل من هنا: المنطقة تخص التصفّح في الرئيسية
 * (`AppHeader`)، وتكرارها في كل صفحة داخلية كان يزحم الترويسة بلا فائدة.
 *
 * قرار تصميمي معتمد: زر الرجوع في **يمين** الهيدر، مطابقًا لعُرف RTL على
 * أندرويد وiOS.
 */
export function BackHeader({ onBack, end, className }: BackHeaderProps) {
  const title = usePageTitleStore((state) => state.title);
  const titleVisibleInPage = usePageTitleStore((state) => state.visible);

  return (
    <header
      style={{ viewTransitionName: 'app-header' }}
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-surface/90 px-2 pt-safe pb-1.5 backdrop-blur-md',
        // الحد السفلي يظهر فقط حين يمرّ المحتوى تحته، كما في iOS
        title && titleVisibleInPage ? 'border-transparent' : 'border-border',
        'transition-[border-color] duration-200',
        className
      )}
    >
      <div className="flex flex-1 items-center">
        <BackButton {...(onBack ? { onBack } : {})} />
      </div>

      {title ? (
        <p
          aria-hidden={titleVisibleInPage}
          className={cn(
            'line-clamp-1 max-w-[60%] text-center text-card-title font-bold text-ink-900 transition-[opacity,translate] duration-200',
            titleVisibleInPage ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
          )}
        >
          {title}
        </p>
      ) : (
        <BrandMark />
      )}

      <div className="flex min-w-0 flex-1 items-center justify-end">{end}</div>
    </header>
  );
}

/** زر الرجوع في `AppHeader` — يختفي في الشاشات الجذرية كالرئيسية. */
export function AutoBackButton() {
  const pathname = usePathname();
  if (!pathname || isRootPath(pathname)) return null;
  return <BackButton />;
}

/**
 * زر الرجوع الموحّد — في `BackHeader` و`AppHeader`.
 * بلا `onBack` يستخدم `useSafeBack`: يعمل حتى حين لا توجد صفحة سابقة.
 */
export function BackButton({ onBack, className }: { onBack?: () => void; className?: string }) {
  const safeBack = useSafeBack();

  return (
    <button
      type="button"
      onClick={() => (onBack ? onBack() : safeBack())}
      aria-label="رجوع"
      className={cn(
        'pressable flex size-11 shrink-0 items-center justify-center rounded-full text-ink-900 hover:bg-bg',
        className
      )}
    >
      <ArrowRight size={24} />
    </button>
  );
}
