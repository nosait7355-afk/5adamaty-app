import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ORDER_STATUS_LABELS_AR, type OrderStatus } from '@/shared/constants/order-status';
import { TIMELINE_ORDER } from '@/server/policies/order-state-machine';

export interface StatusStepperHProps {
  status: OrderStatus;
  /** طابع زمني لكل مرحلة منجزة — يُقرأ من `statusHistory`. */
  timestamps?: Partial<Record<OrderStatus, string>>;
  className?: string;
}

/**
 * مؤشر حالة أفقي بأربع خطوات — الصور 27، 28، 29.
 *
 * أربع مراحل لا سبع: «في الطريق» و«قيد التنفيذ» مرحلة واحدة بصريًا كما في
 * التصميم، والانتقال بينهما ذهابًا وإيابًا لا يُرجِع المؤشر للخلف.
 *
 * الترتيب مأخوذ من `TIMELINE_ORDER` في الـState Machine — مصدر واحد للحقيقة
 * بدل تكرار الترتيب هنا.
 */
const STAGES: { key: OrderStatus; label: string }[] = [
  { key: 'NEW', label: ORDER_STATUS_LABELS_AR.NEW },
  { key: 'ACCEPTED', label: ORDER_STATUS_LABELS_AR.ACCEPTED },
  { key: 'IN_PROGRESS', label: 'التنفيذ' },
  { key: 'COMPLETED', label: ORDER_STATUS_LABELS_AR.COMPLETED },
];

export function StatusStepperH({ status, timestamps, className }: StatusStepperHProps) {
  const currentRank = TIMELINE_ORDER[status];
  const isCancelled = status === 'CANCELLED' || status === 'REJECTED';

  return (
    <ol
      className={cn('flex items-start', className)}
      aria-label={`حالة الطلب: ${ORDER_STATUS_LABELS_AR[status]}`}
    >
      {STAGES.map((stage, index) => {
        const rank = TIMELINE_ORDER[stage.key];
        const isDone = !isCancelled && rank < currentRank;
        const isCurrent = !isCancelled && rank === currentRank;

        /* الطلب الملغى/المرفوض: المراحل التالية لا تُعلَّم منجزة */
        const tone = isCancelled
          ? index === 0
            ? 'bg-danger text-white'
            : 'border-2 border-ink-300 bg-surface text-ink-400'
          : isDone
            ? 'bg-success text-white'
            : isCurrent
              ? 'bg-brand-600 text-white'
              : 'border-2 border-ink-300 bg-surface text-ink-400';

        return (
          <li
            key={stage.key}
            className="flex flex-1 flex-col items-center gap-1.5"
            aria-current={isCurrent ? 'step' : undefined}
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1',
                  index === 0 ? 'invisible' : isDone || isCurrent ? 'bg-success' : 'bg-border'
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'num flex size-8 shrink-0 items-center justify-center rounded-full text-badge font-bold',
                  tone
                )}
              >
                {isDone ? <Check size={16} strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn('h-0.5 flex-1', index === STAGES.length - 1 ? 'invisible' : 'bg-border')}
                aria-hidden="true"
              />
            </div>

            <span
              className={cn(
                'text-center text-badge font-semibold',
                isCurrent ? 'text-brand-600' : isDone ? 'text-success' : 'text-ink-400'
              )}
            >
              {stage.label}
            </span>

            {timestamps?.[stage.key] && (
              <span className="num text-center text-[10px] text-ink-400">
                {timestamps[stage.key]}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
