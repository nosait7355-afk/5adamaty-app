'use client';

import { useState } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card, SectionHeader } from '@/components/ui/card';
import { Badge, Chip } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { InfoAlert } from '@/components/common/info-alert';
import { FileHint } from '@/components/common/file-hint';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { useCategories, useDocumentRequirements, useProfessions } from '@/lib/queries/catalog';
import { formatServicesCount } from '@/lib/format';

/**
 * صفحة تحقّق حيّة لـPhase 2.
 *
 * تثبت أن المسار الكامل يعمل فعليًا:
 * MongoDB → Repository → Service → API Route → TanStack Query → UI
 *
 * وتُظهر محرّك المستندات الديناميكية عمليًا: تغيير المهنة يعيد بناء قائمة
 * المستندات من قاعدة البيانات بلا أي قائمة ثابتة في الواجهة.
 */
export default function DataVerificationPage() {
  const [categoryId, setCategoryId] = useState<string>('');
  const [professionId, setProfessionId] = useState<string>('');

  const categories = useCategories();
  const professions = useProfessions(categoryId || undefined);
  const requirements = useDocumentRequirements(professionId || undefined);

  return (
    <>
      <AppHeader />

      <PageContainer>
        <PageTitle
          title="تحقّق البيانات"
          subtitle="Phase 2 — الكتالوج والمستندات الديناميكية من قاعدة البيانات"
        />

        {/* ---------- التصنيفات ---------- */}
        <section className="mb-8">
          <SectionHeader
            title="التصنيفات"
            action={
              categories.data && (
                <span className="num text-label text-brand-600">{categories.data.length}</span>
              )
            }
            className="mb-3"
          />

          {categories.isPending && <SkeletonList count={3} Item={CategoryRowSkeleton} />}
          {categories.isError && <ErrorState onRetry={() => categories.refetch()} />}
          {categories.data && categories.data.length === 0 && (
            <EmptyState message="لا توجد تصنيفات" description="شغّل npm run db:seed لملء البيانات." />
          )}

          {categories.data && categories.data.length > 0 && (
            <div className="flex flex-col gap-2">
              {categories.data.map((category) => (
                <Card key={category.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-card-title font-bold text-ink-900">{category.name}</p>
                    <p className="line-clamp-1 text-meta text-ink-400">{category.description}</p>
                  </div>
                  <Badge tone="brand" className="shrink-0">
                    <span className="num">{formatServicesCount(category.servicesCount)}</span>
                  </Badge>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ---------- محرّك المستندات الديناميكية ---------- */}
        <section className="mb-8">
          <SectionHeader title="المستندات الديناميكية" className="mb-3" />

          <Card className="mb-3 flex flex-col gap-4">
            <Field label="التصنيف الرئيسي" htmlFor="cat">
              <Select
                id="cat"
                placeholder="اختر التصنيف"
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setProfessionId('');
                }}
                options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>

            <Field label="التخصص الدقيق" htmlFor="prof" hint="القائمة تعتمد على التصنيف المختار">
              <Select
                id="prof"
                placeholder={categoryId ? 'اختر التخصص' : 'اختر التصنيف أولًا'}
                value={professionId}
                disabled={!categoryId || professions.isPending}
                onChange={(event) => setProfessionId(event.target.value)}
                options={(professions.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
          </Card>

          {requirements.isPending && professionId && <SkeletonList count={3} Item={DocRowSkeleton} />}
          {requirements.isError && <ErrorState onRetry={() => requirements.refetch()} />}

          {!professionId && (
            <InfoAlert tone="info">
              اختر مهنة لعرض المستندات المطلوبة لها. القائمة تأتي بالكامل من قاعدة البيانات — لا توجد
              أي قائمة ثابتة في الواجهة.
            </InfoAlert>
          )}

          {requirements.data && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Chip selected>{requirements.data.professionName}</Chip>
                <Badge tone={requirements.data.requiresQualification ? 'success' : 'neutral'}>
                  {requirements.data.requiresQualification ? 'يتطلب مؤهلًا' : 'بلا مؤهل'}
                </Badge>
                <Badge tone={requirements.data.requiresLicense ? 'success' : 'neutral'}>
                  {requirements.data.requiresLicense ? 'يتطلب ترخيصًا' : 'بلا ترخيص'}
                </Badge>
              </div>

              {requirements.data.requirements.map((requirement) => (
                <Card key={`${requirement.key}-${requirement.customKey ?? ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-card-title font-bold text-ink-900">
                        {requirement.label}
                        {requirement.required && (
                          <span className="ms-1 text-danger" aria-hidden="true">
                            *
                          </span>
                        )}
                      </p>
                      <p className="text-meta text-ink-400">{requirement.description}</p>
                      <FileHint
                        accept={requirement.accept}
                        maxSizeMB={requirement.maxSizeMB}
                        className="mt-1"
                      />
                    </div>
                    <Badge tone={requirement.required ? 'danger' : 'neutral'} className="shrink-0">
                      {requirement.required ? 'مطلوب' : 'اختياري'}
                    </Badge>
                  </div>
                </Card>
              ))}

              <InfoAlert tone="brand">
                عدد المستندات: <span className="num">{requirements.data.requirements.length}</span> ·
                إلزامي:{' '}
                <span className="num">
                  {requirements.data.requirements.filter((r) => r.required).length}
                </span>{' '}
                · اختياري:{' '}
                <span className="num">
                  {requirements.data.requirements.filter((r) => !r.required).length}
                </span>
              </InfoAlert>
            </div>
          )}
        </section>

        <div className="h-8" />
      </PageContainer>

      <BottomNav />
    </>
  );
}

function CategoryRowSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="mt-2 h-4 w-2/3" />
    </div>
  );
}

function DocRowSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-2 h-4 w-3/4" />
    </div>
  );
}
