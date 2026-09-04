'use client';

import type { ReactNode } from 'react';
import { Inbox, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  /** النص الوسطي الرمادي — كما في الصور 15، 25، 26. */
  message: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** نسخة مصغّرة تُستخدم داخل بطاقة («لا توجد مرفقات مع هذا الطلب»). */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  message,
  description,
  icon,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  if (compact) {
    return <p className={cn('py-2 text-meta text-ink-400', className)}>{message}</p>;
  }

  return (
    <div
      className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center', className)}
      role="status"
    >
      <span className="text-ink-300" aria-hidden="true">
        {icon ?? <Inbox size={48} strokeWidth={1.5} />}
      </span>
      <p className="text-card-title font-bold text-ink-600">{message}</p>
      {description && <p className="max-w-xs text-meta text-ink-400">{description}</p>}
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  message?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * حالة الخطأ — غير موجودة في الصور، مشتقّة من نفس شكل `InfoAlert`
 * بلون الخطر كما نصّ UI_ANALYSIS §1.6.
 */
export function ErrorState({
  message = 'تعذّر تحميل البيانات',
  description = 'تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-danger/25 bg-danger-bg px-4 py-8 text-center',
        className
      )}
      role="alert"
    >
      <span className="text-danger" aria-hidden="true">
        <WifiOff size={40} strokeWidth={1.5} />
      </span>
      <p className="text-card-title font-bold text-ink-900">{message}</p>
      <p className="max-w-xs text-meta text-ink-600">{description}</p>
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry} iconStart={<RefreshCw size={16} />}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
