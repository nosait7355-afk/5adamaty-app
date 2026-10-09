'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSafeBack } from '@/lib/navigation-history';

/** بعد هذا التمرير (px) تكون صورة الغلاف قد غابت تقريبًا تحت الشريط. */
const SOLID_AFTER = 150;

/**
 * شريط ملف مقدم الخدمة — شفاف فوق صورة الغلاف، ويصير صلبًا باسم مقدم
 * الخدمة حين يُمرَّر الغلاف بعيدًا. نمط صفحات المتاجر والأماكن في تطبيقات
 * الخرائط والتوصيل: الصورة تملأ الشاشة، والأزرار تبقى في متناول الإبهام.
 */
export function ProfileTopBar({ title, actions }: { title: string; actions?: ReactNode }) {
  const safeBack = useSafeBack();
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setSolid(window.scrollY > SOLID_AFTER);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      style={{ viewTransitionName: 'app-header' }}
      data-solid={solid || undefined}
      className={cn(
        'group fixed inset-x-0 top-0 z-30 pt-safe transition-[background-color,border-color] duration-200',
        solid
          ? 'border-b border-border bg-surface/95 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex h-14 max-w-[520px] items-center gap-2 px-3">
        <TopBarButton label="رجوع" onClick={safeBack}>
          <ArrowRight size={20} />
        </TopBarButton>

        <p
          aria-hidden={!solid}
          className={cn(
            'line-clamp-1 flex-1 text-center text-card-title font-bold text-ink-900 transition-[opacity,translate] duration-200',
            solid ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          )}
        >
          {title}
        </p>

        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}

/**
 * زر دائري: «زجاجي» فوق الصورة كي يُقرأ على أي لون، وشفاف حين يصير
 * الشريط صلبًا (يقرأ حالة الشريط من `data-solid` على الأب).
 */
export function TopBarButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  /** لأزرار التبديل (المفضلة) — يُعلن حالته لقارئ الشاشة. */
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        'pressable flex size-10 shrink-0 items-center justify-center rounded-full text-ink-900',
        'bg-surface/85 shadow-card backdrop-blur-md',
        'group-data-[solid]:bg-transparent group-data-[solid]:shadow-none'
      )}
    >
      {children}
    </button>
  );
}
