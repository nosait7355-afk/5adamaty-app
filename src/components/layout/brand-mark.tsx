import { BrandIcon } from './brand-icon';
import { cn } from '@/lib/cn';
import { BRAND_NAME } from '@/shared/brand';

export interface BrandMarkProps {
  /** يخفي النص ويُبقي الأيقونة فقط. */
  iconOnly?: boolean;
  size?: number;
  className?: string;
  priority?: boolean;
}

/**
 * علامة التطبيق: الأيقونة + اسم المنتج + «كل الخدمات في مكان واحد».
 *
 * الأيقونة وحدها (`BrandIcon`) لا ملف الشعار كاملًا: الملف يحمل اسم «خدماتي
 * الفيوم» مرسومًا، والاسم هنا نص يختلف بين الموقع وتطبيق «خدمات الفيوم».
 * تظهر في وسط الهيدر في كل الشاشات الداخلية.
 */
export function BrandMark({ iconOnly = false, size = 40, className, priority = false }: BrandMarkProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <BrandIcon size={size} priority={priority} className="shrink-0" />
      <span className="sr-only">{BRAND_NAME}</span>
      {!iconOnly && (
        // تحت 380px تُخفى الكتلة النصية ويبقى الشعار وحده،
        // وإلا تداخل الاسم مع منتقي المنطقة وزر الرجوع في الترويسة.
        <div className="hidden leading-tight min-[380px]:block" aria-hidden="true">
          <p className="whitespace-nowrap text-card-title font-extrabold text-brand-600">
            {BRAND_NAME}
          </p>
          <p className="whitespace-nowrap text-[10px] text-ink-400">كل الخدمات في مكان واحد</p>
        </div>
      )}
    </div>
  );
}
