'use client';

import { useEffect, useState } from 'react';

/** لا تختفي الترويسة في أول الصفحة — قبل هذا الحد تبقى ظاهرة دائمًا. */
const REVEAL_ZONE = 80;
/** تمرير صغير لأعلى (أقل من هذا) لا يُظهرها — يمنع الارتعاش مع الإصبع. */
const SHOW_THRESHOLD = 12;

/**
 * يخفي الترويسة مع التمرير لأسفل ويُظهرها فور التمرير لأعلى — نمط فيسبوك
 * وتيك توك: مساحة أكبر للمحتوى أثناء القراءة، والترويسة على بعد حركة
 * إصبع واحدة.
 */
export function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let upDistance = 0;
    let frame = 0;

    const onScroll = () => {
      // قراءة واحدة لكل إطار — التمرير يطلق أحداثًا أكثر بكثير من الإطارات
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - lastY;
        lastY = y;

        if (y < REVEAL_ZONE) {
          upDistance = 0;
          setHidden(false);
        } else if (delta > 0) {
          upDistance = 0;
          setHidden(true);
        } else if (delta < 0) {
          upDistance -= delta;
          if (upDistance > SHOW_THRESHOLD) setHidden(false);
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return hidden;
}
