'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Flame, ShieldCheck } from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { SectionHeader } from '@/components/ui/card';
import { CategoryCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { CategoryCard } from '@/components/features/discovery/category-cards';
import { SearchBox } from '@/components/features/discovery/search-box';
import { PopularServices } from '@/components/features/discovery/popular-services';
import { useCategories } from '@/lib/queries/catalog';

/**
 * التصنيفات — الصورة 08، موحّدة مع الصورة 07 حسب قرار `UI_ANALYSIS §2`.
 *
 * هذه الشاشة تعرض **التصنيفات الرئيسية** + قسم «أكثر الخدمات طلبًا»،
 * والدخول في تصنيف يعرض مهنه (`/categories/[slug]`) ثم خدماته.
 */
export default function CategoriesPage() {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const categories = useCategories();

  return (
    <>
      <AppHeader />

      <PageContainer className="flex flex-col gap-5">
        <PageTitle title="التصنيفات" subtitle="اختر التصنيف المناسب لخدمتك" />

        <SearchBox
          value={term}
          onValueChange={setTerm}
          onSubmit={() => {
            const trimmed = term.trim();
            if (trimmed.length > 0) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
          }}
          placeholder="ابحث في التصنيفات…"
        />

        {categories.isPending ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <CategoryCardSkeleton key={index} />
            ))}
          </div>
        ) : categories.isError ? (
          <ErrorState onRetry={() => void categories.refetch()} />
        ) : categories.data.length === 0 ? (
          <EmptyState message="لا توجد تصنيفات بعد" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {categories.data.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}

        {/* ---- أكثر الخدمات طلبًا — القسم المرقّم في الصورة 07 ---- */}
        <section aria-label="أكثر الخدمات طلبًا">
          <SectionHeader
            title="أكثر الخدمات طلبًا"
            icon={<Flame size={20} />}
            className="mb-3"
          />
          <PopularServices limit={4} />
        </section>

        {/* ---- بانر «جودة مضمونة» — الصورة 07 ---- */}
        <section className="flex items-center gap-3 rounded-card bg-brand-50 p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-success">
            <ShieldCheck size={26} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-card-title font-bold text-ink-900">جودة مضمونة</h3>
            <p className="text-meta text-ink-600">
              كل مقدم خدمة يظهر هنا مرّت مستنداته بمراجعة الإدارة واعتُمدت.
            </p>
          </div>
        </section>
      </PageContainer>

      <BottomNav />
    </>
  );
}
