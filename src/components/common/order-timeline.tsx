import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TimelineItem {
  title: string;
  description?: string;
  /** التاريخ يظهر في أقصى نهاية السطر (يسار في RTL) — الصورة 14. */
  timestamp?: string;
  state: 'done' | 'current' | 'pending';
}

export interface OrderTimelineProps {
  items: readonly TimelineItem[];
  className?: string;
}

/**
 * الخط الزمني العمودي لحالة الطلب — الصورة 14.
 *
 * الدوائر: ✓ أخضر للمنجز · ◉ أزرق للحالي · ○ رمادي للقادم.
 * الخط الواصل: متصل للمنجز، منقّط للقادم.
 */
export function OrderTimeline({ items, className }: OrderTimelineProps) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <li key={item.title} className="flex gap-3">
            {/* عمود الدائرة والخط */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full',
                  item.state === 'done' && 'bg-success text-white',
                  item.state === 'current' && 'border-[3px] border-brand-600 bg-surface',
                  item.state === 'pending' && 'border-2 border-ink-300 bg-surface'
                )}
                aria-hidden="true"
              >
                {item.state === 'done' && <Check size={14} strokeWidth={3} />}
                {item.state === 'current' && <span className="size-2 rounded-full bg-brand-600" />}
              </span>

              {!isLast && (
                <span
                  className={cn(
                    'w-0.5 flex-1',
                    item.state === 'done'
                      ? 'bg-success'
                      : 'border-s-2 border-dashed border-ink-300 bg-transparent'
                  )}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* المحتوى */}
            <div className={cn('flex flex-1 justify-between gap-3', isLast ? 'pb-0' : 'pb-6')}>
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-label font-bold',
                    item.state === 'pending' ? 'text-ink-400' : 'text-ink-900',
                    item.state === 'current' && 'text-brand-600'
                  )}
                >
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-badge leading-5 text-ink-400">{item.description}</p>
                )}
              </div>

              <span className="num shrink-0 text-badge text-ink-400">{item.timestamp ?? '-'}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
