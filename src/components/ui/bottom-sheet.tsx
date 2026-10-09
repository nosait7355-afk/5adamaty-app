'use client';

import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { pushOverlay } from '@/lib/overlay-stack';

export interface BottomSheetProps {
  open: boolean;
  /** يُستدعى عند كل طلب إغلاق: الخلفية، السحب لأسفل، Esc، أو زر رجوع أندرويد. */
  onClose: () => void;
  title: ReactNode;
  /** إجراء صغير بجوار العنوان (مثل «إعادة ضبط»). */
  headerAction?: ReactNode;
  children: ReactNode;
  /** أزرار ثابتة أسفل الشيت لا تتمرّر مع المحتوى. */
  footer?: ReactNode;
  /** يخفي العنوان بصريًا ويُبقيه لقارئ الشاشة — لشيت التأكيد المتمركز. */
  hideTitle?: boolean;
  className?: string;
}

/** المسافة (px) التي إن سُحب الشيت أبعد منها لأسفل يُغلق. */
const DISMISS_DISTANCE = 90;
/** السحب السريع يُغلق حتى لو كانت المسافة قصيرة (px/ms). */
const DISMISS_VELOCITY = 0.6;

/**
 * Bottom Sheet — بديل القوائم المنسدلة والنوافذ المنبثقة على الموبايل.
 *
 * مبني على `<dialog>` الأصلي (`showModal`) لا على مكتبة: المتصفح يتكفّل
 * بحبس التركيز، وجعل ما خلفه غير تفاعلي، وإعادة التركيز للزر الذي فتحه،
 * والإغلاق بـEsc. الحركة في `globals.css` (`.sheet`).
 *
 * متحكَّم فيه بالكامل: `open` هو مصدر الحقيقة، وكل طرق الإغلاق تمرّ عبر
 * `onClose` ولا تُغلق الحوار مباشرة.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  headerAction,
  children,
  footer,
  hideTitle = false,
  className,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /* ---- مزامنة `open` مع الحوار الأصلي ---- */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      // jsdom وبعض المتصفحات القديمة بلا showModal — نكتفي بالسمة
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  /* ---- زر رجوع أندرويد يُغلق الشيت لا الصفحة ---- */
  useEffect(() => {
    if (!open) return;
    return pushOverlay(() => onCloseRef.current());
  }, [open]);

  /* ---- السحب لأسفل للإغلاق — من المقبض والعنوان فقط كي لا يعطّل التمرير ---- */
  const drag = useRef<{ startY: number; startTime: number; dy: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // أزرار الترويسة (إعادة ضبط…) تبقى قابلة للضغط
    if ((event.target as HTMLElement).closest('button, a')) return;
    drag.current = { startY: event.clientY, startTime: event.timeStamp, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    dialogRef.current?.setAttribute('data-dragging', '');
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const dialog = dialogRef.current;
    if (!state || !dialog) return;
    // لأعلى: مقاومة خفيفة بدل حركة حرة، كما في iOS
    const dy = event.clientY - state.startY;
    state.dy = dy;
    dialog.style.translate = `0 ${dy > 0 ? dy : dy / 6}px`;
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const dialog = dialogRef.current;
    drag.current = null;
    if (!state || !dialog) return;

    dialog.removeAttribute('data-dragging');
    dialog.style.translate = '';

    const velocity = state.dy / Math.max(event.timeStamp - state.startTime, 1);
    if (state.dy > DISMISS_DISTANCE || (state.dy > 20 && velocity > DISMISS_VELOCITY)) {
      onCloseRef.current();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={cn('sheet', className)}
      onCancel={(event) => {
        // Esc: نُبقي القرار للمكوّن الأب بدل أن يُغلق المتصفح الحوار بنفسه
        event.preventDefault();
        onCloseRef.current();
      }}
      onClick={(event) => {
        // الضغط على الخلفية المعتمة يصل للحوار نفسه لا لمحتواه
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        className="shrink-0 cursor-grab touch-none select-none px-page pb-2 pt-2.5"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-pill bg-border" aria-hidden="true" />
        <div className={cn('flex items-center justify-between gap-3', hideTitle && 'sr-only')}>
          <h2 id={titleId} className="text-section font-extrabold text-ink-900">
            {title}
          </h2>
          {headerAction}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-page pb-4">
        {children}
      </div>

      {footer && <div className="shrink-0 border-t border-border px-page pb-3 pt-3">{footer}</div>}
    </dialog>
  );
}
