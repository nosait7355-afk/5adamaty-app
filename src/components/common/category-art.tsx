import Image from 'next/image';
import { CatalogIcon } from './catalog-icon';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { cn } from '@/lib/cn';

/**
 * التصنيفات التي لها رسمة افتراضية مضمّنة في `public/categories/{slug}.svg` —
 * رسومات مسطّحة بأسلوب واحد بألوان التطبيق، واحدة لكل تصنيف أساسي.
 */
const DEFAULT_ART_SLUGS = new Set([
  'home-services',
  'medical-services',
  'legal-services',
  'car-services',
  'tech-services',
  'plumbing-electric',
  'beauty-care',
  'education-training',
  'events',
  'real-estate',
  'delivery',
]);

/** رسمة «كل التصنيفات» — العنصر الأخير في شريط الرئيسية. */
export const ALL_CATEGORIES_ART = '/categories/all.svg';

/**
 * مصدر صورة التصنيف بالأولوية:
 *   1. صورة رفعتها الإدارة (Cloudinary) — تغلب دائمًا.
 *   2. الرسمة الافتراضية المضمّنة للتصنيفات الأساسية.
 *   3. `null` — تصنيف جديد بلا صورة: تُعرض أيقونته كما كانت.
 */
export function categoryArtSrc(category: { slug: string; image?: string | undefined }): string | null {
  if (category.image) return category.image;
  return DEFAULT_ART_SLUGS.has(category.slug) ? `/categories/${category.slug}.svg` : null;
}

export interface CategoryArtProps {
  category: { slug: string; icon?: string | undefined; image?: string | undefined };
  /** القطر بالبكسل. */
  size: number;
  className?: string;
  priority?: boolean;
}

/**
 * صورة التصنيف داخل دائرة — في شريط الرئيسية وبطاقات شاشة التصنيفات.
 *
 * الصورة زخرفية (`alt=""`): اسم التصنيف مكتوب بجوارها دائمًا، فوصفها لقارئ
 * الشاشة يكرّر الاسم مرتين.
 */
export function CategoryArt({ category, size, className, priority = false }: CategoryArtProps) {
  const src = categoryArtSrc(category);
  const uploaded = Boolean(category.image);

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        // الخلفية للأيقونة والصور المرفوعة؛ الرسومات الافتراضية دائرة كاملة بلونها
        !src || uploaded ? 'bg-brand-50 text-brand-600' : '',
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          // صورة الإدارة بالمقاس المطلوب من Cloudinary؛ الرسمة SVG تُقدَّم كما هي
          src={uploaded ? (cloudinaryUrl(src, { width: size * 2, height: size * 2 }) ?? src) : src}
          alt=""
          width={size}
          height={size}
          priority={priority}
          unoptimized={!uploaded}
          className="size-full object-cover"
        />
      ) : (
        <CatalogIcon name={category.icon} size={Math.round(size * 0.42)} />
      )}
    </span>
  );
}
