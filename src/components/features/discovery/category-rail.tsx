import Link from 'next/link';
import { CatalogIcon } from '@/components/common/catalog-icon';
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
 */
export function CategoryRail({ categories }: { categories: CategoryDto[] }) {
  return (
    <ul className="scroll-x snap-row -mx-page flex scroll-px-page gap-3 px-page pb-1">
      {categories.map((category) => (
        <li key={category.id} className="shrink-0">
          <RailItem
            href={`/categories/${category.slug}`}
            label={category.name}
            icon={category.icon}
          />
        </li>
      ))}
      <li className="shrink-0">
        <RailItem href="/categories" label="كل التصنيفات" icon="grid" />
      </li>
    </ul>
  );
}

function RailItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      transitionTypes={NAV_FORWARD}
      className="pressable flex w-[4.5rem] flex-col items-center gap-1.5 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <CatalogIcon name={icon} size={26} />
      </span>
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
