'use client';

import { forwardRef, useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * الأيقونة الدلالية — تظهر في **بداية** السطر (يمين في RTL).
   * قرار توحيد من UI_ANALYSIS §1.5 لأن الصور تتباين في موضعها.
   */
  icon?: ReactNode;
  /** عنصر إجراء في **نهاية** السطر (يسار في RTL) — مثل زر الإظهار أو السهم. */
  action?: ReactNode;
  invalid?: boolean;
  /** إضافة زر 👁 لإظهار/إخفاء كلمة المرور (الصور 03، 05، 19). */
  togglePassword?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, action, invalid = false, togglePassword = false, type = 'text', className, ...rest },
  ref
) {
  const [revealed, setRevealed] = useState(false);
  const toggleId = useId();

  const isPassword = type === 'password';
  const effectiveType = isPassword && revealed ? 'text' : type;

  return (
    <div
      className={cn(
        'flex h-control items-center gap-3 rounded-field border bg-surface px-4',
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

      <input
        ref={ref}
        type={effectiveType}
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 bg-transparent text-body text-ink-900 outline-none placeholder:text-ink-400"
        {...rest}
      />

      {isPassword && togglePassword && (
        <button
          type="button"
          id={toggleId}
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          aria-pressed={revealed}
          className="shrink-0 rounded p-1 text-ink-400 transition-colors hover:text-ink-600"
        >
          {revealed ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      )}

      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
});
