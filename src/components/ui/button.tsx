import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

/**
 * الزر — مستخرج من الصور المرجعية.
 *
 * - `primary`   : تدرّج أزرق + ظل (زر «تسجيل الدخول» الصورة 03، «التالي» الصورة 19)
 * - `secondary` : أبيض بحد أزرق (زر «تواصل واتساب» الصورة 10، «السابق» الصورة 21)
 * - `success`   : أخضر ممتلئ (زر «إكمال الطلب» الصور 28، 29)
 * - `danger`    : أبيض بحد أحمر ونص أحمر (زر «إلغاء الطلب» الصورة 14)
 * - `warning`   : برتقالي ممتلئ (زر «تحديث الحالة» الصورة 25)
 * - `ghost`     : بلا خلفية ولا حد (روابط «عرض الكل»)
 */
const VARIANTS = {
  primary:
    'bg-linear-to-l from-brand-500 to-brand-700 text-white shadow-brand hover:brightness-105 active:brightness-95',
  secondary:
    'bg-surface text-brand-600 border border-brand-600 hover:bg-brand-50 active:bg-brand-100',
  success: 'bg-success text-white hover:brightness-105 active:brightness-95',
  danger: 'bg-surface text-danger border border-danger hover:bg-danger-bg active:brightness-95',
  warning: 'bg-warning text-white hover:brightness-105 active:brightness-95',
  neutral: 'bg-surface text-ink-600 border border-border hover:bg-bg active:brightness-95',
  ghost: 'bg-transparent text-brand-600 hover:bg-brand-50',
} as const;

/** الارتفاعات من قياسات الصور: الزر الأساسي 56px، الثانوي 48px، الصغير 36px. */
const SIZES = {
  lg: 'h-control px-6 text-[1rem]',
  md: 'h-12 px-5 text-label',
  sm: 'h-9 px-4 text-meta',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/** أصناف الزر — مشتركة بين `<button>` و`<Link>` حتى لا يتفرّع المظهر. */
export function buttonClassName({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-field font-bold',
    'transition-[filter,background-color,box-shadow] duration-150',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** يملأ عرض الحاوية — السلوك الافتراضي لأزرار النماذج في الصور. */
  fullWidth?: boolean;
  loading?: boolean;
  /** أيقونة قبل النص (بداية السطر = يمين في RTL). */
  iconStart?: ReactNode;
  /** أيقونة بعد النص (نهاية السطر = يسار في RTL). */
  iconEnd?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'lg',
    fullWidth = false,
    loading = false,
    iconStart,
    iconEnd,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  const isDisabled = disabled === true || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, fullWidth, ...(className ? { className } : {}) })}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'sm' ? 14 : 18} className="shrink-0" />
      ) : (
        iconStart && <span className="shrink-0">{iconStart}</span>
      )}
      {children}
      {iconEnd && !loading && <span className="shrink-0">{iconEnd}</span>}
    </button>
  );
});

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
}

/**
 * زر بمظهر الزر ودلالة الرابط.
 *
 * كثير من «الأزرار» في الصور تنقل بين الشاشات («عرض التفاصيل» في 09،
 * «اطلب الخدمة» في 10). تنفيذها كـ`<button onClick=router.push>` يكسر
 * فتح الرابط في تبويب جديد ويحرم قارئ الشاشة من دلالة الرابط.
 */
export function LinkButton({
  href,
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  iconStart,
  iconEnd,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={buttonClassName({ variant, size, fullWidth, ...(className ? { className } : {}) })}
      {...rest}
    >
      {iconStart && <span className="shrink-0">{iconStart}</span>}
      {children}
      {iconEnd && <span className="shrink-0">{iconEnd}</span>}
    </Link>
  );
}
