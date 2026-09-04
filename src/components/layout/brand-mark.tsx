import Image from 'next/image';
import { cn } from '@/lib/cn';

export interface BrandMarkProps {
  /** يخفي النص ويُبقي الأيقونة فقط. */
  iconOnly?: boolean;
  size?: number;
  className?: string;
  priority?: boolean;
}

/**
 * علامة التطبيق: الأيقونة + «خدماتي الفيوم» + «كل الخدمات في مكان واحد».
 * تظهر في وسط الهيدر في كل الشاشات الداخلية.
 */
export function BrandMark({ iconOnly = false, size = 40, className, priority = false }: BrandMarkProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <Image
        src="/logo.png"
        alt="خدماتي الفيوم"
        width={size}
        height={size}
        priority={priority}
        className="shrink-0 object-contain"
      />
      {!iconOnly && (
        // تحت 380px تُخفى الكتلة النصية ويبقى الشعار وحده،
        // وإلا تداخل الاسم مع منتقي المنطقة وزر الرجوع في الترويسة.
        <div className="hidden leading-tight min-[380px]:block">
          <p className="whitespace-nowrap text-card-title font-extrabold text-brand-600">
            خدماتي الفيوم
          </p>
          <p className="whitespace-nowrap text-[10px] text-ink-400">كل الخدمات في مكان واحد</p>
        </div>
      )}
    </div>
  );
}
