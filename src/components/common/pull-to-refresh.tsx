'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';

/** المسافة (بعد المقاومة) التي يُطلق عندها التحديث عند رفع الإصبع. */
const TRIGGER = 72;
/** أقصى نزول للمؤشر مهما سُحب. */
const MAX_PULL = 110;
/** السحب الفعلي أطول من حركة المؤشر — مقاومة تشبه الشد المطاطي. */
const RESISTANCE = 0.5;
/** أقل مدة لدوران المؤشر — تحديث يصل في 50ms لا يُرى أصلًا فيبدو أنه لم يحدث. */
const MIN_SPIN_MS = 600;

/**
 * «اسحب لتحديث» لكل الصفحات — يُركَّب مرة واحدة في `AppProviders`.
 *
 * WebView أندرويد لا يملك سحبًا للتحديث، وسحب كروم الأصلي يعيد تحميل
 * الصفحة كلها. هذا يعيد جلب بيانات الصفحة الحالية فقط (كل استعلامات
 * TanStack النشطة) دون فقد موضع ولا حالة. سحب المتصفح الأصلي معطّل بـ
 * `overscroll-behavior-y` في globals.css كي لا يعمل الاثنان معًا.
 *
 * لا يبدأ إلا من أعلى الصفحة تمامًا، ولا داخل شيت مفتوح أو حقل إدخال.
 */
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  /** الإصبع على الشاشة: المؤشر يتبعه فورًا بلا انتقال. */
  const [dragging, setDragging] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let startY: number | null = null;
    let distance = 0;

    const onStart = (event: TouchEvent) => {
      if (refreshingRef.current || event.touches.length !== 1 || window.scrollY > 0) return;
      const target = event.target as Element | null;
      if (target?.closest('dialog, input, textarea, select, [data-no-pull]')) return;
      startY = event.touches[0]?.clientY ?? null;
      distance = 0;
    };

    const onMove = (event: TouchEvent) => {
      if (startY === null) return;
      const dy = (event.touches[0]?.clientY ?? startY) - startY;
      // تمرير لأعلى، أو الصفحة تحرّكت — ليس سحبًا للتحديث
      if (dy <= 0 || window.scrollY > 0) {
        if (distance !== 0) {
          distance = 0;
          setPull(0);
        }
        return;
      }
      distance = Math.min(dy * RESISTANCE, MAX_PULL);
      setDragging(true);
      setPull(distance);
    };

    const onEnd = async () => {
      if (startY === null) return;
      startY = null;
      setDragging(false);

      if (distance < TRIGGER) {
        setPull(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      setPull(TRIGGER);
      const started = Date.now();
      try {
        await queryClient.refetchQueries({ type: 'active' });
      } finally {
        const wait = MIN_SPIN_MS - (Date.now() - started);
        if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
        refreshingRef.current = false;
        setRefreshing(false);
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [queryClient]);

  const progress = Math.min(pull / TRIGGER, 1);

  return (
    <div
      aria-hidden={!refreshing}
      role="status"
      aria-label={refreshing ? 'جارٍ التحديث' : undefined}
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-50 flex justify-center"
      style={{
        translate: `0 ${pull - 48}px`,
        opacity: pull === 0 ? 0 : 0.4 + progress * 0.6,
        // يتبع الإصبع فورًا أثناء السحب، ويعود بحركة حين يُفلت
        transition: dragging ? 'none' : 'translate 250ms ease, opacity 200ms',
      }}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-surface text-brand-600 shadow-card-hover">
        <RefreshCw
          size={20}
          className={cn(refreshing && 'animate-spin-slow')}
          style={refreshing ? undefined : { rotate: `${progress * 270}deg` }}
        />
      </span>
    </div>
  );
}
