'use client';

import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  onClear?: () => void;
}

/**
 * حقل البحث — الصور 06، 07، 08، 09، 18.
 * ارتفاع 56، radius 12، أيقونة البحث في **نهاية** السطر (يسار في RTL)،
 * والـplaceholder يبدأ من اليمين.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onValueChange, onClear, placeholder = 'ابحث عن خدمة أو مقدم خدمة…', className, ...rest },
  ref
) {
  return (
    <div
      className={cn(
        'flex h-control items-center gap-3 rounded-field border border-border bg-surface px-4',
        'transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100',
        className
      )}
    >
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label="بحث"
        className={cn(
          'min-w-0 flex-1 bg-transparent text-body text-ink-900 outline-none placeholder:text-ink-400',
          // إخفاء زر المسح الأصلي للمتصفح — لدينا زرّنا الخاص
          '[&::-webkit-search-cancel-button]:hidden'
        )}
        {...rest}
      />

      {value.length > 0 && (
        <button
          type="button"
          onClick={() => {
            onValueChange('');
            onClear?.();
          }}
          aria-label="مسح البحث"
          className="shrink-0 rounded-full p-1 text-ink-400 transition-colors hover:bg-bg hover:text-ink-600"
        >
          <X size={18} />
        </button>
      )}

      <Search size={22} className="shrink-0 text-brand-600" aria-hidden="true" />
    </div>
  );
});
