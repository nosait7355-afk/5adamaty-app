'use client';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export interface ProfileTab {
  key: string;
  label: string;
  count?: number;
}

export interface ProfileTabsProps {
  tabs: ProfileTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

/**
 * تبويبات ملف مقدم الخدمة — الصورة 10.
 * نبذة / الخدمات / الصور / التقييمات (128) — النشط بخط سفلي أزرق.
 */
export function ProfileTabs({ tabs, active, onChange, className }: ProfileTabsProps) {
  return (
    <div
      role="tablist"
      className={cn('scroll-x flex border-b border-border', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.key}`}
            {...(tab.count != null
              ? { 'aria-label': `${tab.label}، ${formatNumber(tab.count)}` }
              : {})}
            onClick={() => onChange(tab.key)}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-4 pb-3 pt-2 text-label font-bold transition-colors',
              isActive
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-ink-400 hover:text-ink-600'
            )}
          >
            {tab.label}
            {/*
              العدّاد معروض بصريًا داخل قوسين، والاسم المتاح يأتي من
              `aria-label` أعلاه: خوارزمية حساب الاسم تقصّ الفراغات حول كل
              عنصر داخلي، فينطق القارئ «التقييمات128» بلا فاصل لو تُرك للنص.
            */}
            {tab.count != null && <span className="num ms-1">({formatNumber(tab.count)})</span>}
          </button>
        );
      })}
    </div>
  );
}
