import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export interface StepperStep {
  label: string;
  /** طابع زمني اختياري تحت التسمية — يظهر في StatusStepperH (الصور 27–29). */
  hint?: string;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  /** رقم الخطوة الحالية، يبدأ من 1. */
  current: number;
  className?: string;
}

/**
 * مؤشر الخطوات الأفقي — الصور 11، 12، 19، 20، 21، 22.
 *
 * ترتيب RTL: الخطوة 1 في أقصى **اليمين**. الحاوية ترث `dir="rtl"` من الجذر،
 * فالعنصر الأول في المصفوفة يُرسم يمينًا تلقائيًا بلا أي عكس يدوي.
 */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol
      className={cn('flex items-start', className)}
      aria-label={`الخطوة ${formatNumber(current)} من ${formatNumber(steps.length)}`}
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isDone = stepNumber < current;
        const isCurrent = stepNumber === current;
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.label}
            className="flex flex-1 flex-col items-center gap-2"
            aria-current={isCurrent ? 'step' : undefined}
          >
            <div className="flex w-full items-center">
              {/* الخط الواصل يُرسم قبل الدائرة لكل خطوة عدا الأولى */}
              <span
                className={cn(
                  'h-0.5 flex-1',
                  index === 0 ? 'invisible' : isDone || isCurrent ? 'bg-brand-600' : 'bg-border'
                )}
                aria-hidden="true"
              />

              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full text-label font-bold',
                  'transition-colors',
                  isDone && 'bg-brand-600 text-white',
                  isCurrent && 'bg-brand-600 text-white ring-4 ring-brand-100',
                  !isDone && !isCurrent && 'border border-border bg-surface text-ink-400'
                )}
              >
                {isDone ? <Check size={20} strokeWidth={3} /> : <span className="num">{stepNumber}</span>}
              </span>

              <span
                className={cn(
                  'h-0.5 flex-1',
                  isLast ? 'invisible' : isDone ? 'bg-brand-600' : 'bg-border'
                )}
                aria-hidden="true"
              />
            </div>

            <span
              className={cn(
                'text-center text-badge leading-tight',
                isCurrent ? 'font-bold text-brand-600' : 'text-ink-400'
              )}
            >
              {step.label}
            </span>

            {step.hint && <span className="num text-center text-[10px] text-ink-400">{step.hint}</span>}
          </li>
        );
      })}
    </ol>
  );
}
