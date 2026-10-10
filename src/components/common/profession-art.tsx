import Image from 'next/image';
import { CatalogIcon } from './catalog-icon';
import { professionArtSrc } from '@/lib/profession-art';
import { cn } from '@/lib/cn';

export interface ProfessionArtProps {
  slug: string | undefined;
  /** أيقونة المهنة — تظهر فقط لتخصص بلا رسمة (تخصص جديد أضافته الإدارة). */
  icon: string | undefined;
  /** القطر بالبكسل. */
  size: number;
  className?: string;
}

/**
 * رسمة التخصص داخل دائرة — شبكة التخصصات، اقتراحات البحث، «الأكثر طلبًا»،
 * وقائمة الإدارة. زخرفية (`alt=""`): اسم التخصص مكتوب بجوارها دائمًا.
 */
export function ProfessionArt({ slug, icon, size, className }: ProfessionArtProps) {
  const src = professionArtSrc(slug);

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        !src && 'bg-brand-50 text-brand-600',
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt="" width={size} height={size} unoptimized className="size-full" />
      ) : (
        <CatalogIcon name={icon} size={Math.round(size * 0.5)} />
      )}
    </span>
  );
}
