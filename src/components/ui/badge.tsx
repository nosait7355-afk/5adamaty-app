import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { StatusTone } from '@/shared/constants/order-status';

/** ألوان الحالات — مستخرجة من badges الصور 13، 14، 25–29. */
const TONES: Record<StatusTone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  purple: 'bg-purple-bg text-purple',
  neutral: 'bg-bg text-ink-600',
};

export interface BadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** شارة حالة على شكل pill — 12px/600 (UI_ANALYSIS §1.4). */
export function Badge({ tone = 'neutral', children, icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-badge font-semibold',
        TONES[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  /** عدّاد بجانب النص — «الكل (6)» في الصورة 13. */
  count?: number;
  className?: string;
}

/**
 * قرص قابل للاختيار — شريط الفلاتر (09) وتبويبات الحالة (13، 15، 25).
 * يُعرض كزر عند وجود onClick وإلا كوسم ثابت.
 */
export function Chip({ children, selected = false, onClick, icon, count, className }: ChipProps) {
  const content = (
    <>
      {icon}
      {children}
      {count !== undefined && <span className="num">({count})</span>}
    </>
  );

  const classes = cn(
    'inline-flex shrink-0 items-center gap-1.5 rounded-pill px-4 py-2 text-label font-semibold',
    'transition-colors',
    selected
      ? 'bg-brand-600 text-white'
      : 'border border-border bg-surface text-ink-600 hover:bg-brand-50',
    className
  );

  if (!onClick) {
    return <span className={classes}>{content}</span>;
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={classes}>
      {content}
    </button>
  );
}

export interface NotificationDotProps {
  /** عدد غير المقروء. `undefined` أو `0` = لا شيء يُعرض. */
  count?: number;
  /** نقطة صمّاء بلا رقم — تُستخدم عند معرفة وجود جديد دون عدده. */
  dot?: boolean;
  className?: string;
}

/**
 * نقطة/عدّاد أحمر فوق أيقونات Bottom Nav والجرس.
 *
 * لا يُعرض شيء ما لم يُطلب صراحةً: إما `count > 0` أو `dot`.
 * (بدون هذا الشرط كانت الشارة تظهر فوق كل عنصر تنقّل بلا عدّاد.)
 */
export function NotificationDot({ count, dot = false, className }: NotificationDotProps) {
  const hasCount = count !== undefined && count > 0;
  if (!hasCount && !dot) return null;

  return (
    <span
      aria-label={hasCount ? `${count} غير مقروء` : 'يوجد جديد'}
      className={cn(
        'absolute -top-1 flex items-center justify-center rounded-full bg-danger text-white',
        'end-0 translate-x-1/3',
        hasCount ? 'num min-w-[18px] px-1 py-px text-[10px] font-bold leading-tight' : 'size-2.5',
        className
      )}
    >
      {hasCount ? (count > 99 ? '99+' : count) : null}
    </span>
  );
}
