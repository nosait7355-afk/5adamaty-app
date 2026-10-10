import Image from 'next/image';
import { CatalogIcon } from '@/components/common/catalog-icon';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { cn } from '@/lib/cn';

export interface MediaThumbProps {
  url?: string | undefined;
  alt: string;
  size: number;
  /** أيقونة المهنة — تُعرض بديلًا عند غياب الصورة بدل مربع رمادي فارغ. */
  iconName?: string | undefined;
  /** رسمة التخصص (`professionArtSrc`) — تسبق الأيقونة حين لا توجد صورة. */
  fallbackArt?: string | undefined;
  rounded?: 'card' | 'field' | 'full';
  className?: string;
  priority?: boolean;
}

const ROUNDING = {
  card: 'rounded-card',
  field: 'rounded-field',
  full: 'rounded-full',
} as const;

/**
 * صورة مصغّرة بأبعاد ثابتة.
 *
 * الأبعاد مثبتة على الحاوية (لا `auto`) حتى لا يحدث Layout Shift عند وصول
 * الصورة — أحد معايير القبول في Phase 5.
 */
export function MediaThumb({
  url,
  alt,
  size,
  iconName,
  fallbackArt,
  rounded = 'field',
  className,
  priority = false,
}: MediaThumbProps) {
  const optimized = cloudinaryUrl(url, { width: size, height: size });

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden bg-brand-50',
        ROUNDING[rounded],
        className
      )}
      style={{ width: size, height: size }}
    >
      {optimized ? (
        <Image
          src={optimized}
          alt={alt}
          width={size}
          height={size}
          priority={priority}
          className="size-full object-cover"
        />
      ) : fallbackArt ? (
        <Image
          src={fallbackArt}
          // زخرفية: اسم الخدمة أو مقدم الخدمة مكتوب بجوارها دائمًا
          alt=""
          width={size}
          height={size}
          unoptimized
          className={cn(
            'size-full',
            /*
             * الرسمة دائرة كاملة: في الحاوية المربعة تُكبَّر ×1.42 فتغطي دائرتُها
             * الزوايا (نصف قطرها يصير 68 ≥ بُعد الزاوية 67.9 في إطار 96)، والرسمة
             * نفسها (حتى ~32 من المركز ← 45 بعد التكبير) تبقى داخل الإطار (48).
             */
            rounded !== 'full' && 'scale-[1.42]'
          )}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-brand-600">
          <CatalogIcon name={iconName} size={Math.round(size * 0.42)} />
        </span>
      )}
    </div>
  );
}
