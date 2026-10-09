'use client';

import { useEffect } from 'react';
import { AlertCircle, Check, Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore, type ToastTone } from '@/lib/toast';

/** مدة الظهور — أطول حين يوجد إجراء ليتسع وقت الضغط على «تراجع». */
const DURATION_MS = 2800;
const DURATION_WITH_ACTION_MS = 5000;

const ICONS: Record<ToastTone, { icon: React.ReactNode; className: string }> = {
  success: { icon: <Check size={14} strokeWidth={3} />, className: 'bg-success' },
  error: { icon: <AlertCircle size={14} strokeWidth={2.5} />, className: 'bg-danger' },
  info: { icon: <Info size={14} strokeWidth={2.5} />, className: 'bg-brand-500' },
};

/**
 * مكان عرض الـToast — يُركَّب مرة واحدة في `AppProviders`.
 *
 * أعلى الشاشة تحت شريط الحالة: الأسفل مشغول بشريط التنقّل وأزرار
 * التواصل الثابتة. `aria-live` يُسمِع الرسالة لقارئ الشاشة دون نقل التركيز.
 * الضغط على الرسالة يخفيها.
 */
export function Toaster() {
  const current = useToastStore((state) => state.current);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(
      () => dismiss(current.id),
      current.action ? DURATION_WITH_ACTION_MS : DURATION_MS
    );
    return () => window.clearTimeout(timer);
  }, [current, dismiss]);

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto max-w-[520px] px-page pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]"
    >
      {current && (
        <div
          key={current.id}
          onClick={() => dismiss(current.id)}
          className="toast pointer-events-auto flex items-center gap-2.5 rounded-card bg-ink-900 px-4 py-3 text-label font-semibold text-white shadow-card-hover"
        >
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full text-white',
              ICONS[current.tone].className
            )}
            aria-hidden="true"
          >
            {ICONS[current.tone].icon}
          </span>
          <span className="min-w-0 flex-1">{current.message}</span>
          {current.action && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                current.action?.onClick();
                dismiss(current.id);
              }}
              className="pressable shrink-0 rounded-field px-2 py-1 font-extrabold text-brand-200"
            >
              {current.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
