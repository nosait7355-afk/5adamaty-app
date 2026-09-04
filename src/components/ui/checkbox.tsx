import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  invalid?: boolean;
}

/** مربع اختيار — «تذكرني» (03)، «أوافق على الشروط» (05)، «أؤكد استلام المبلغ» (29). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, invalid = false, className, id, ...rest },
  ref
) {
  return (
    <label
      htmlFor={id}
      className={cn('flex cursor-pointer items-start gap-3 text-label text-ink-600', className)}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        aria-invalid={invalid || undefined}
        className={cn(
          'mt-0.5 size-5 shrink-0 cursor-pointer rounded-[6px] border-2 bg-surface',
          'accent-brand-600 transition-colors',
          invalid ? 'border-danger' : 'border-ink-300'
        )}
        {...rest}
      />
      {label && <span className="leading-6">{label}</span>}
    </label>
  );
});

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

/** زر اختيار — «ذكر/أنثى» (19)، «تحديد سعر تقريبي / لاحقًا» (20). */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, className, id, ...rest },
  ref
) {
  return (
    <label
      htmlFor={id}
      className={cn('flex cursor-pointer items-center gap-3 text-label text-ink-600', className)}
    >
      <input
        ref={ref}
        id={id}
        type="radio"
        className="size-5 shrink-0 cursor-pointer accent-brand-600"
        {...rest}
      />
      {label && <span>{label}</span>}
    </label>
  );
});
