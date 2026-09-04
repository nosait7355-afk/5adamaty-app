import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CatalogIcon } from '@/components/common/catalog-icon';
import { cn } from '@/lib/cn';
import { formatServicesCount } from '@/lib/format';
import type { CategoryDto, ProfessionDto } from '@/server/services/catalog.service';

/**
 * ثلاث صيغ لعرض الكتالوج، كل واحدة مرسومة في صورة مختلفة:
 *
 * - `CategoryTile`     — مربع 1:1 مصغّر، صف من 6 في الرئيسية (الصورة 06).
 * - `CategoryCard`     — بطاقة بدائرة 84px ووصف وشريط عدّاد (الصورة 08).
 * - `ProfessionCard`   — بطاقة مسطّحة بأيقونة ملوّنة وعدّاد (الصورة 07).
 */

export interface CategoryTileProps {
  href: string;
  label: string;
  icon?: string | undefined;
  className?: string;
}

/** مربع التصنيف المصغّر — الصورة 06. */
export function CategoryTile({ href, label, icon, className }: CategoryTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-1 rounded-field',
        'border border-border bg-surface p-1 text-center transition-colors hover:bg-brand-50',
        className
      )}
    >
      <span className="text-brand-600">
        <CatalogIcon name={icon} size={20} />
      </span>
      <span className="line-clamp-2 w-full px-0.5 text-[11px] font-semibold leading-tight text-ink-700">
        {label}
      </span>
    </Link>
  );
}

export interface CategoryCardProps {
  category: CategoryDto;
  className?: string;
}

/** بطاقة التصنيف الكاملة — شبكة 3×3 في الصورة 08. */
export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-card border border-border bg-surface',
        'p-3 text-center shadow-card transition-shadow hover:shadow-card-hover',
        className
      )}
    >
      {/*
        الدائرة 84px في التصميم الأصلي مقاسة على بطاقة أعرض؛ في شبكة 3×3
        على عرض 375px يتبقى ~109px للبطاقة، فتُصغَّر إلى 64px حتى لا تدفع
        الحشو خارج البطاقة. النسب البصرية محفوظة.
      */}
      <span className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <CatalogIcon name={category.icon} size={28} />
      </span>

      <h3 className="line-clamp-2 text-meta font-bold text-ink-900">{category.name}</h3>
      <p className="line-clamp-2 text-[11px] leading-tight text-ink-400">{category.description}</p>

      <span className="mt-auto inline-flex w-full items-center justify-center gap-1 border-t border-border pt-2 text-[11px] font-semibold text-brand-600">
        <span className="num">{formatServicesCount(category.servicesCount)}</span>
        <ChevronLeft size={14} aria-hidden="true" />
      </span>
    </Link>
  );
}

export interface ProfessionCardProps {
  profession: ProfessionDto;
  categorySlug: string;
  className?: string;
}

/** بطاقة المهنة المسطّحة — شبكة 3×N في الصورة 07. */
export function ProfessionCard({ profession, categorySlug, className }: ProfessionCardProps) {
  return (
    <Link
      href={`/services?categorySlug=${categorySlug}&professionSlug=${profession.slug}`}
      className={cn(
        'flex flex-col items-center gap-2 rounded-field border border-border bg-surface',
        'p-3 text-center transition-colors hover:bg-brand-50',
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-field bg-brand-50 text-brand-600">
        <CatalogIcon name={profession.icon} size={24} />
      </span>
      <span className="line-clamp-1 w-full text-label font-bold text-ink-900">
        {profession.name}
      </span>
      <span className="num text-meta text-ink-400">
        {formatServicesCount(profession.servicesCount)}
      </span>
    </Link>
  );
}
