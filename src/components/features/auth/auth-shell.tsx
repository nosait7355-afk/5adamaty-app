'use client';

import type { ReactNode } from 'react';
import { useSafeBack } from '@/lib/navigation-history';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BrandIcon } from '@/components/layout/brand-icon';
import { CitySkyline } from './city-skyline';
import { LegalLinks } from '@/components/features/legal/legal-page';

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** يخفي زر الرجوع — لأول شاشة في المسار. */
  hideBack?: boolean;
  onBack?: () => void;
  footer?: ReactNode;
  className?: string;
}

/**
 * الهيكل المشترك لشاشات المصادقة — الصور 03 و05.
 *
 * التخطيط من التصميم: زر رجوع في **اليمين** (بقرار لاحق يطابق عُرف RTL —
 * كان في اليسار مطابقةً حرفية للصور المرجعية) · اللوجو والاسم والشعار
 * وسطًا · العنوان والوصف · المحتوى · الفوتر · رسم معالم الفيوم أسفل الصفحة.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  hideBack = false,
  onBack,
  footer,
  className,
}: AuthShellProps) {
  // شاشات المصادقة للزوّار — الرجوع الافتراضي لاختيار نوع الحساب
  const safeBack = useSafeBack('/role-select');

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-bg">
      {/* زر الرجوع — يمين الشاشة */}
      {!hideBack && (
        <button
          type="button"
          onClick={() => (onBack ? onBack() : safeBack())}
          aria-label="رجوع"
          className="absolute start-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex size-11 items-center justify-center rounded-field text-brand-600 transition-colors hover:bg-brand-50"
        >
          <ArrowRight size={24} />
        </button>
      )}

      <div
        className={cn(
          'relative z-10 mx-auto flex w-full max-w-[520px] flex-1 flex-col px-page pb-8 pt-safe',
          className
        )}
      >
        {/* العلامة */}
        <div className="flex flex-col items-center pt-10">
          <BrandIcon size={92} priority />
          <h1 className="mt-1 text-[1.75rem] font-extrabold leading-tight text-brand-600">
            خدماتي الفيوم
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-px w-8 bg-brand-500" aria-hidden="true" />
            <span className="text-meta text-ink-600">كل الخدمات في مكان واحد</span>
            <span className="h-px w-8 bg-brand-500" aria-hidden="true" />
          </div>
        </div>

        {/* العنوان */}
        <div className="mt-8 text-center">
          <h2 className="text-screen-title font-extrabold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-2 text-body text-ink-400">{subtitle}</p>}
        </div>

        {/* المحتوى */}
        <div className="mt-6 flex flex-col gap-5">{children}</div>

        {footer && <div className="mt-6">{footer}</div>}

        <LegalLinks className="mt-4 justify-center" />

        <div className="flex-1" />
      </div>

      {/* رسم المعالم — زخرفي أسفل الصفحة */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 select-none opacity-70">
        <CitySkyline />
      </div>
    </main>
  );
}
