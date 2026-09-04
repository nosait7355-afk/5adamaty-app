import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * أيقونة العلامة فقط (الدبوس) بلا نص.
 *
 * لماذا القص؟ ملف `public/logo.png` (1230×1278) هو قفل علامة كامل:
 * الأيقونة في الأعلى ثم «خدماتي الفيوم» ثم «كل الخدمات في مكان واحد».
 * الشاشات التي ترسم الاسم نصًا (Splash، اختيار نوع الحساب، شاشات المصادقة)
 * تحتاج الأيقونة وحدها، وإلا ظهر الاسم مرتين.
 *
 * الأيقونة تشغل أعلى ~72% من ارتفاع الملف، فنقصّه بحاوية `overflow-hidden`
 * بدل توليد ملف ثانٍ.
 */

/**
 * نسبة ارتفاع الأيقونة إلى ارتفاع الملف كاملًا.
 * مضبوطة بصريًا: 0.72 كانت تُبقي نقاط حروف «خدماتي» ظاهرة أسفل الأيقونة.
 */
const ICON_RATIO = 0.66;

export function BrandIcon({
  size = 96,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn('relative block overflow-hidden', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/logo.png"
        alt=""
        width={size}
        height={Math.round(size / ICON_RATIO)}
        priority={priority}
        className="absolute inset-x-0 top-0 max-w-none object-contain"
        style={{ width: size, height: Math.round(size / ICON_RATIO) }}
      />
    </span>
  );
}
