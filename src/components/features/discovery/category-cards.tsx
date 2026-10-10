import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CategoryArt } from '@/components/common/category-art';
import { cn } from '@/lib/cn';
import { formatServicesCount } from '@/lib/format';
import { NAV_FORWARD } from '@/lib/view-transitions';
import type { CategoryDto, ProfessionDto } from '@/server/services/catalog.service';
import { ProfessionArt } from '@/components/common/profession-art';

/**
 * صيغتان لعرض الكتالوج (شريط الرئيسية الدائري في `category-rail.tsx`):
 *
 * - `CategoryCard`     — بطاقة بدائرة 84px ووصف وشريط عدّاد (الصورة 08).
 * - `ProfessionCard`   — بطاقة مسطّحة بأيقونة ملوّنة وعدّاد (الصورة 07).
 */

export interface CategoryCardProps {
  category: CategoryDto;
  className?: string;
}

/** بطاقة التصنيف الكاملة — شبكة 3×3 في الصورة 08. */
export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      transitionTypes={NAV_FORWARD}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-card border border-border bg-surface',
        'pressable p-3 text-center shadow-card hover:shadow-card-hover',
        className
      )}
    >
      {/*
        الدائرة 84px في التصميم الأصلي مقاسة على بطاقة أعرض؛ في شبكة 3×3
        على عرض 375px يتبقى ~109px للبطاقة، فتُصغَّر إلى 64px حتى لا تدفع
        الحشو خارج البطاقة. النسب البصرية محفوظة. الدائرة صورة التصنيف
        (صورة الإدارة أو الرسمة الافتراضية) — `CategoryArt`.
      */}
      <CategoryArt category={category} size={64} />

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
      transitionTypes={NAV_FORWARD}
      className={cn(
        'flex flex-col items-center gap-2 rounded-field border border-border bg-surface',
        'p-3 text-center transition-colors hover:bg-brand-50',
        className
      )}
    >
      <ProfessionArt slug={profession.slug} icon={profession.icon} size={52} />
      <span className="line-clamp-1 w-full text-label font-bold text-ink-900">
        {profession.name}
      </span>
      <span className="num text-meta text-ink-400">
        {formatServicesCount(profession.servicesCount)}
      </span>
    </Link>
  );
}
