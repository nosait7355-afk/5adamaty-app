import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** يزيل الحشو الداخلي — للبطاقات التي تحتوي صورة ممتدة للحافة. */
  flush?: boolean;
  interactive?: boolean;
}

/** البطاقة الأساسية: أبيض · radius 16 · حد خفيف · ظل ناعم (UI_ANALYSIS §1.3). */
export function Card({ flush = false, interactive = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface shadow-card',
        !flush && 'p-4',
        interactive && 'transition-shadow hover:shadow-card-hover',
        className
      )}
      {...rest}
    />
  );
}

export interface SectionHeaderProps {
  title: string;
  /** رابط «عرض الكل» في نهاية السطر (يسار في RTL) — نمط متكرر في الصور 06، 07، 10. */
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** ترويسة قسم: العنوان يمينًا ورابط الإجراء يسارًا. */
export function SectionHeader({ title, action, icon, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 text-section font-bold text-ink-900">
        {icon && <span className="text-brand-600">{icon}</span>}
        {title}
      </h2>
      {action}
    </div>
  );
}
