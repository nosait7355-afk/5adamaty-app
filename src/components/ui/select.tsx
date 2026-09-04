import { forwardRef } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: readonly SelectOption[];
  /** النص الرمادي قبل الاختيار — «اختر منطقتك» في الصور. */
  placeholder?: string;
  icon?: ReactNode;
  invalid?: boolean;
}

/**
 * قائمة منسدلة أصلية (native) — مقصود.
 * على الموبايل تفتح المنتقي الأصلي للنظام، وهو أفضل للمس وأخف وأكثر
 * إتاحة من أي بديل مخصّص.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, icon, invalid = false, className, defaultValue, value, ...rest },
  ref
) {
  const isEmpty = (value ?? defaultValue ?? '') === '';

  return (
    <div
      className={cn(
        'relative flex h-control items-center gap-3 rounded-field border bg-surface px-4',
        'transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100',
        invalid ? 'border-danger' : 'border-border',
        className
      )}
    >
      {icon && (
        <span className={cn('shrink-0', invalid ? 'text-danger' : 'text-brand-600')} aria-hidden="true">
          {icon}
        </span>
      )}

      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'min-w-0 flex-1 appearance-none bg-transparent text-body outline-none',
          isEmpty ? 'text-ink-400' : 'text-ink-900'
        )}
        {...(value !== undefined ? { value } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>

      {/* السهم في نهاية السطر (يسار في RTL) — مطابق للصور */}
      <ChevronDown size={20} className="pointer-events-none shrink-0 text-ink-400" aria-hidden="true" />
    </div>
  );
});
