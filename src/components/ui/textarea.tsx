import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

/** حقل نص متعدد الأسطر — يُستخدم مع عدّاد Field (الصور 11، 19، 20). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, rows = 4, className, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full resize-y rounded-field border bg-surface px-4 py-3',
        'text-body text-ink-900 outline-none placeholder:text-ink-400',
        'transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-100',
        invalid ? 'border-danger' : 'border-border',
        className
      )}
      {...rest}
    />
  );
});
