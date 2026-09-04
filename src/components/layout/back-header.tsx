'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from './brand-mark';
import { cn } from '@/lib/cn';
import { GOVERNORATE } from '@/shared/constants/fayoum-areas';
import { MapPin } from 'lucide-react';

export interface BackHeaderProps {
  onBack?: () => void;
  locationLabel?: string;
  /** يستبدل الجانب الأيمن (منتقي المنطقة). */
  start?: ReactNode;
  className?: string;
}

/**
 * ترويسة الصفحات الداخلية — الصور 09، 10، 11، 14، 19–23، 26–29.
 *
 * قرار تصميمي معتمد: زر الرجوع في **يسار** الهيدر بسهم يشير لليسار،
 * كما هو مرسوم حرفيًا في كل الصور المرجعية.
 *
 * عُرض البديل (نقله يمينًا ليطابق عُرف RTL على أندرويد وiOS) واعتُمد
 * الإبقاء على التصميم كما هو. لا تغيّر هذا الموضع بلا قرار جديد.
 */
export function BackHeader({
  onBack,
  locationLabel = GOVERNORATE,
  start,
  className,
}: BackHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border',
        'bg-surface/95 px-page pt-safe pb-3 backdrop-blur-sm',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center">
        {start ?? (
          <span className="flex min-w-0 items-center gap-1 text-label font-semibold text-ink-900">
            <MapPin size={18} className="shrink-0 text-brand-600" aria-hidden="true" />
            <span className="truncate">{locationLabel}</span>
          </span>
        )}
      </div>

      <BrandMark />

      <div className="flex flex-1 items-center justify-end">
        <button
          type="button"
          onClick={handleBack}
          aria-label="رجوع"
          className={cn(
            'flex size-11 items-center justify-center rounded-field border border-border',
            'bg-surface text-brand-600 transition-colors hover:bg-brand-50'
          )}
        >
          <ArrowLeft size={22} />
        </button>
      </div>
    </header>
  );
}
