'use client';

import { useState } from 'react';
import { Save, User } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { ApiClientError } from '@/lib/api-client';
import { formatPhone } from '@/lib/format';
import { useAccountSummary, useUpdateProfile } from '@/lib/queries/account';
import { FAYOUM_CITIES } from '@/shared/constants/fayoum-areas';

interface FormValues {
  fullName: string;
  email: string;
  city: string;
  area: string;
  gender: string;
}

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'ذكر' },
  { value: 'FEMALE', label: 'أنثى' },
];

/**
 * تعديل الملف الشخصي — عميل (الصورة 16، زر «تعديل الملف الشخصي»).
 *
 * نفس حقول `updateProfileSchema` فقط — الهاتف مؤكَّد ولا يُعدَّل من هنا.
 */
export default function AccountProfilePage() {
  const account = useAccountSummary();
  const updateMutation = useUpdateProfile();

  const [values, setValues] = useState<FormValues>({
    fullName: '',
    email: '',
    city: '',
    area: '',
    gender: '',
  });
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  if (account.data && account.data.user.id !== loadedId) {
    const { user } = account.data;
    setLoadedId(user.id);
    setValues({
      fullName: user.fullName,
      email: user.email ?? '',
      city: user.city ?? '',
      area: user.area ?? '',
      gender: '',
    });
  }

  const patch = (next: Partial<FormValues>) => {
    setSaved(false);
    setValues((current) => ({ ...current, ...next }));
  };

  const save = async () => {
    setSaveError('');
    setSaved(false);

    try {
      await updateMutation.mutateAsync({
        fullName: values.fullName,
        ...(values.email ? { email: values.email } : {}),
        ...(values.city ? { city: values.city } : {}),
        ...(values.area ? { area: values.area } : {}),
        ...(values.gender ? { gender: values.gender } : {}),
      });
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

      <PageContainer className="pb-10">
        <PageTitle title="تعديل الملف الشخصي" subtitle="بياناتك الشخصية الظاهرة في حسابك" />

        {account.isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-20 w-full rounded-card" />
            <Skeleton className="h-12 w-full rounded-field" />
            <Skeleton className="h-12 w-full rounded-field" />
            <Skeleton className="h-12 w-full rounded-field" />
          </div>
        ) : account.isError || !account.data ? (
          <ErrorState message="تعذّر تحميل بياناتك" onRetry={() => void account.refetch()} />
        ) : (
          <div className="flex flex-col gap-4">
            {saved && (
              <InfoAlert tone="success" title="تم الحفظ">
                تم تحديث ملفك الشخصي بنجاح.
              </InfoAlert>
            )}

            {saveError && (
              <InfoAlert tone="danger" title="تعذّر الحفظ">
                {saveError}
              </InfoAlert>
            )}

            <Card className="flex items-center gap-4">
              <MediaThumb
                url={account.data.user.avatarUrl}
                alt={account.data.user.fullName}
                size={56}
                rounded="full"
              />
              <div className="min-w-0 flex-1">
                {account.data.user.phone && (
                  <p className="num text-meta text-ink-600">
                    {formatPhone(account.data.user.phone)}
                  </p>
                )}
                <p className="text-badge text-ink-400">لا يمكن تعديل رقم الهاتف المؤكَّد</p>
              </div>
            </Card>

            <Field label="الاسم الكامل" required>
              <Input
                icon={<User size={20} />}
                value={values.fullName}
                onChange={(event) => patch({ fullName: event.target.value })}
              />
            </Field>

            <Field label="البريد الإلكتروني">
              <Input
                type="email"
                dir="ltr"
                value={values.email}
                onChange={(event) => patch({ email: event.target.value })}
              />
            </Field>

            <Field label="المركز/المدينة">
              <Select
                placeholder="اختر المركز"
                options={FAYOUM_CITIES.map((city) => ({ value: city, label: city }))}
                value={values.city}
                // المنطقة = المركز نفسه بعد إزالة الأحياء
                onChange={(event) => patch({ city: event.target.value, area: event.target.value })}
              />
            </Field>

            <Field label="النوع">
              <Select
                placeholder="اختياري"
                options={GENDER_OPTIONS}
                value={values.gender}
                onChange={(event) => patch({ gender: event.target.value })}
              />
            </Field>

            <Button
              fullWidth
              className="mt-2"
              loading={updateMutation.isPending}
              onClick={() => void save()}
              iconStart={<Save size={20} />}
            >
              حفظ التعديلات
            </Button>
          </div>
        )}
      </PageContainer>

      <BottomNav />
    </>
  );
}
