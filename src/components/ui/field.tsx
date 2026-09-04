import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FieldProps {
  /** ربط الـlabel بالحقل. */
  htmlFor?: string;
  label?: string;
  /** يعرض `*` حمراء بجانب الـlabel — كما في الصور 19، 20، 21. */
  required?: boolean;
  hint?: string;
  error?: string;
  /** عدّاد الأحرف `0/500` — يظهر في الصور 11، 19، 20. */
  counter?: { current: number; max: number };
  children: ReactNode;
  className?: string;
}

/**
 * غلاف الحقل: Label + `*` + المحتوى + عدّاد + رسالة خطأ.
 * يوحّد شكل كل حقول النماذج عبر التطبيق.
 */
export function Field({
  htmlFor,
  label,
  required = false,
  hint,
  error,
  counter,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-label font-semibold text-ink-900">
          {label}
          {required && (
            <span className="ms-1 text-danger" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (مطلوب)</span>}
        </label>
      )}

      {children}

      <div className="flex items-start justify-between gap-2">
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className={cn('text-badge', error ? 'text-danger' : 'text-ink-400')}
          role={error ? 'alert' : undefined}
        >
          {error ?? hint ?? ''}
        </p>

        {counter && (
          <span
            className={cn(
              'num shrink-0 text-badge',
              counter.current > counter.max ? 'text-danger' : 'text-ink-400'
            )}
          >
            {counter.current}/{counter.max}
          </span>
        )}
      </div>
    </div>
  );
}
