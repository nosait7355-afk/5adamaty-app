'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import {
  EMPTY_PROFESSION,
  ProfessionStep,
  type ProfessionValues,
} from '@/components/features/provider/profession-step';
import { ApiClientError } from '@/lib/api-client';
import { useMyProviderProfile, useUpdateProviderProfile } from '@/lib/queries/provider';
import { providerStep2Schema } from '@/shared/schemas/provider.schema';

type Errors = Partial<Record<keyof ProfessionValues, string>>;

/**
 * تعديل الملف الشخصي — مقدم خدمة معتمد.
 *
 * نفس حقول الخطوة 2/4 من معالج التسجيل (`ProfessionStep`)، لكن هنا للحفظ
 * الفوري عبر PATCH بدل التنقّل بين خطوات معالج.
 */
export default function ProviderProfilePage() {
  const profile = useMyProviderProfile();
  const updateMutation = useUpdateProviderProfile();

  const [values, setValues] = useState<ProfessionValues>(EMPTY_PROFESSION);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  if (profile.data && profile.data.id !== loadedId) {
    const loaded = profile.data;
    setLoadedId(loaded.id);
    setValues({
      categoryId: loaded.categoryId,
      professionId: loaded.professionId,
      yearsOfExperience: String(loaded.yearsOfExperience),
      bio: loaded.bio,
      coverageAreas: loaded.coverageAreas,
    });
  }

  const save = async () => {
    setSaveError('');
    setSaved(false);

    const result = providerStep2Schema.safeParse({
      categoryId: values.categoryId,
      professionId: values.professionId,
      yearsOfExperience: values.yearsOfExperience,
      bio: values.bio,
      coverageAreas: values.coverageAreas,
    });

    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ProfessionValues | undefined;
        if (key) next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    try {
      await updateMutation.mutateAsync(result.data);
      setSaved(true);
    } catch (error) {
      setSaveError(
        error instanceof ApiClientError ? error.message : 'تعذّر حفظ التعديلات. حاول مرة أخرى.'
      );
    }
  };

  return (
    <>
      <BackHeader />

      <PageContainer withBottomNav={false} className="pb-10">
        <PageTitle title="الملف الشخصي" subtitle="بيانات مهنتك وخدمتك الظاهرة للعملاء" />

        {profile.isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full rounded-field" />
            <Skeleton className="h-12 w-full rounded-field" />
            <Skeleton className="h-32 w-full rounded-card" />
            <Skeleton className="h-48 w-full rounded-card" />
          </div>
        ) : profile.isError || !profile.data ? (
          <ErrorState message="تعذّر تحميل ملفك" onRetry={() => void profile.refetch()} />
        ) : (
          <>
            {saved && (
              <InfoAlert tone="success" title="تم الحفظ" className="mb-4">
                تم تحديث ملفك الشخصي بنجاح.
              </InfoAlert>
            )}

            {saveError && (
              <InfoAlert tone="danger" title="تعذّر الحفظ" className="mb-4">
                {saveError}
              </InfoAlert>
            )}

            <ProfessionStep
              values={values}
              errors={errors}
              onChange={(patch) => {
                setSaved(false);
                setValues((current) => ({ ...current, ...patch }));
              }}
            />

            <Button
              fullWidth
              className="mt-6"
              loading={updateMutation.isPending}
              onClick={() => void save()}
              iconStart={<Save size={20} />}
            >
              حفظ التعديلات
            </Button>
          </>
        )}
      </PageContainer>
    </>
  );
}
