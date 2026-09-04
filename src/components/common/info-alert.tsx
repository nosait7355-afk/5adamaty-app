import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertTone = 'info' | 'warning' | 'success' | 'danger' | 'brand';

const TONES: Record<AlertTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: 'bg-info-bg border-brand-100', icon: 'text-brand-600', Icon: Info },
  brand: { box: 'bg-brand-50 border-brand-100', icon: 'text-brand-600', Icon: ShieldCheck },
  warning: { box: 'bg-warning-bg border-warning/25', icon: 'text-warning', Icon: AlertCircle },
  success: { box: 'bg-success-bg border-success/25', icon: 'text-success', Icon: CheckCircle2 },
  danger: { box: 'bg-danger-bg border-danger/25', icon: 'text-danger', Icon: AlertCircle },
};

export interface InfoAlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * صندوق تنبيه — نمط متكرر في الصور 11، 12، 14، 19، 21، 23، 26، 27، 28، 29.
 *
 * الاستخدام الأبرز: التنبيه البرتقالي الذي يوضّح أن **لا دفع أونلاين** وأن
 * الدفع يتم مباشرة خارج التطبيق.
 */
export function InfoAlert({ tone = 'info', title, children, icon, className }: InfoAlertProps) {
  const { box, icon: iconColor, Icon } = TONES[tone];

  return (
    <div className={cn('flex gap-3 rounded-field border p-4', box, className)}>
      <span className={cn('mt-0.5 shrink-0', iconColor)} aria-hidden="true">
        {icon ?? <Icon size={20} />}
      </span>
      <div className="flex-1 text-meta leading-6 text-ink-600">
        {title && <p className={cn('mb-1 text-label font-bold', iconColor)}>{title}</p>}
        {children}
      </div>
    </div>
  );
}
