'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer } from '@/components/layout/page-container';
import { LinkButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CatalogIcon } from '@/components/common/catalog-icon';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ProfessionCard } from '@/components/features/discovery/category-cards';
import { SearchBox } from '@/components/features/discovery/search-box';
import { useCategories, useProfessions } from '@/lib/queries/catalog';

/**
 * المهن داخل تصنيف — الصورة 07.
 *
 * الهرمية من مستويين: `Category` ← `Profession`. اختيار مهنة ينقل إلى
 * قائمة خدماتها (الصورة 09).
 */
export default function CategoryProfessionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [term, setTerm] = useState('');

  const categories = useCategories();
  const category = categories.data?.find((entry) => entry.slug === slug);
  const professions = useProfessions(category?.id);

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-5 pt-4">
        <header className="flex items-center gap-3">
          {categories.isPending ? (
            <>
              <Skeleton className="size-14 rounded-full" />
              <Skeleton className="h-7 w-40" />
            </>
          ) : (
            <>
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <CatalogIcon name={category?.icon} size={28} />
              </span>
              <div className="min-w-0">
                <h1 className="text-section font-extrabold text-ink-900">
                  {category?.name ?? 'التصنيف'}
                </h1>
                {category?.description && (
                  <p className="line-clamp-2 text-meta text-ink-400">{category.description}</p>
                )}
              </div>
            </>
          )}
        </header>

        <SearchBox
          value={term}
          onValueChange={setTerm}
          onSubmit={() => {
            const trimmed = term.trim();
            if (trimmed.length > 0) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
          }}
          placeholder="ابحث داخل هذا التصنيف…"
        />

        {categories.isError ? (
          <ErrorState onRetry={() => void categories.refetch()} />
        ) : !categories.isPending && !category ? (
          <EmptyState
            message="التصنيف غير موجود"
            description="ربما تغيّر الرابط أو أُزيل التصنيف."
            action={
              <LinkButton href="/categories" size="sm" variant="secondary">
                كل التصنيفات
              </LinkButton>
            }
          />
        ) : professions.isPending || categories.isPending ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-field" />
            ))}
          </div>
        ) : professions.isError ? (
          <ErrorState onRetry={() => void professions.refetch()} />
        ) : professions.data.length === 0 ? (
          <EmptyState message="لا توجد مهن داخل هذا التصنيف بعد" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {professions.data.map((profession) => (
              <ProfessionCard key={profession.id} profession={profession} categorySlug={slug} />
            ))}
          </div>
        )}

        {category && (
          <LinkButton href={`/services?categorySlug=${slug}`} fullWidth>
            عرض كل خدمات {category.name}
          </LinkButton>
        )}

        <section className="flex items-center gap-3 rounded-card bg-brand-50 p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-success">
            <ShieldCheck size={26} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-card-title font-bold text-ink-900">جودة مضمونة</h2>
            <p className="text-meta text-ink-600">
              مقدمو الخدمات المعروضون هنا معتمدون بعد مراجعة مستنداتهم.
            </p>
          </div>
        </section>
      </PageContainer>

      <BottomNav />
    </>
  );
}
