import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ALL_CATEGORIES_ART, CategoryArt } from '@/components/common/category-art';
import { Skeleton } from '@/components/ui/skeleton';
import { NAV_FORWARD } from '@/lib/view-transitions';
import type { CategoryDto } from '@/server/services/catalog.service';

/**
 * شريط التصنيفات في الرئيسية — دوائر تتمرّر أفقيًا، كقصص إنستجرام وفئات
 * تطبيقات التوصيل.
 *
 * بدل شبكة من ستة مربعات على 375px كان النص فيها 11px ومقصوصًا: هنا كل
 * التصنيفات بأسماء مقروءة، والدائرة السابعة نصف ظاهرة تقول إن هناك المزيد.
 * يمتدّ إلى حافتي الشاشة (`-mx-page`) كما في التطبيقات الأصلية.
 *
 * كل دائرة صورة التصنيف (`CategoryArt`): صورة الإدارة أو الرسمة الافتراضية.
 */
export function CategoryRail({ categories }: { categories: CategoryDto[] }) {
  return (
    <ul className="scroll-x snap-row -mx-page flex scroll-px-page gap-3 px-page pb-1">
      {categories.map((category, index) => (
        <li key={category.id} className="shrink-0">
          <RailItem
            href={`/categories/${category.slug}`}
            label={category.name}
            // الدوائر الظاهرة أول فتح الرئيسية تُحمَّل فورًا، والباقي عند التمرير
            art={<CategoryArt category={category} size={64} priority={index < 5} />}
          />
        </li>
      ))}
      <li className="shrink-0">
        <RailItem
          href="/categories"
          label="كل التصنيفات"
          art={
            <Image
              src={ALL_CATEGORIES_ART}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="size-16"
            />
          }
        />
      </li>
    </ul>
  );
}

function RailItem({ href, label, art }: { href: string; label: string; art: ReactNode }) {
  return (
    <Link
      href={href}
      transitionTypes={NAV_FORWARD}
      className="pressable flex w-[4.5rem] flex-col items-center gap-1.5 text-center"
    >
      {art}
      <span className="line-clamp-2 text-badge font-semibold leading-tight text-ink-700">
        {label}
      </span>
    </Link>
  );
}

export function CategoryRailSkeleton() {
  return (
    <div className="-mx-page flex gap-3 overflow-hidden px-page" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
