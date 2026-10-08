'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquareQuote, Save, Settings, Star, Wrench } from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import {
  EMPTY_PROFESSION,
  ProfessionStep,
  type ProfessionValues,
} from '@/components/features/provider/profession-step';
import { PortfolioSection } from '@/components/features/provider/portfolio-section';
import {
  CompleteProfileCard,
  PROFILE_FIELD_IDS,
  buildCompletionTasks,
} from '@/components/features/provider/complete-profile-card';
import {
  EMPTY_PROVIDER_DETAILS,
  ProviderDetailsSection,
  type ProviderDetailsValues,
} from '@/components/features/provider/provider-details-section';
import { ApiClientError } from '@/lib/api-client';
import { formatNumber, formatRating } from '@/lib/format';
import {
  useMyProviderProfile,
  useProviderDashboard,
  useUpdateProviderProfile,
} from '@/lib/queries/provider';
import { updateProviderProfileSchema } from '@/shared/schemas/provider.schema';
import { cn } from '@/lib/cn';

type Errors = Partial<Record<keyof ProfessionValues | keyof ProviderDetailsValues, string>>;

/**
 * ملفي — مقدم خدمة معتمد.
 *
 * تبويب "الرئيسية" في شريط تنقّل مقدم الخدمة صار يعرض تصفّح الخدمات
 * (نفس صفحة العميل)، فانتقلت مؤشرات لوحة التحكم القديمة (الصورة 24) إلى
 * هنا: أعلى صفحة "ملفي" — المكان الذي يفتحه مقدم الخدمة أصلًا لإدارة حسابه.
 */
export default function ProviderProfilePage() {
  const dashboard = useProviderDashboard();
  const profile = useMyProviderProfile();
  const updateMutation = useUpdateProviderProfile();

  const [values, setValues] = useState<ProfessionValues>(EMPTY_PROFESSION);
  const [details, setDetails] = useState<ProviderDetailsValues>(EMPTY_PROVIDER_DETAILS);
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
      yearsOfExperience:
        loaded.yearsOfExperience != null ? String(loaded.yearsOfExperience) : '',
      bio: loaded.bio,
      coverageAreas: loaded.coverageAreas,
    });
    setDetails({
      city: loaded.user.city ?? '',
      addressLine: loaded.user.addressLine ?? '',
      accountType: loaded.accountType,
      gender: loaded.personal.gender ?? '',
      birthDate: loaded.personal.birthDate ?? '',
    });
  }

  /** المعتمد لا يغيّر مهنته من هنا — المستندات المطلوبة مبنية عليها. */
  const lockProfession = profile.data?.verification.status === 'APPROVED';

  const save = async () => {
    setSaveError('');
    setSaved(false);

    const result = updateProviderProfileSchema.safeParse({
      categoryId: values.categoryId,
      professionId: values.professionId,
      yearsOfExperience: values.yearsOfExperience,
      bio: values.bio,
      coverageAreas: values.coverageAreas,
      ...(details.city ? { city: details.city } : {}),
      addressLine: details.addressLine,
      accountType: details.accountType,
      // الاختياريان الفارغان لا يُرسلان — لا مسح لقيمة لم يلمسها
      ...(details.gender ? { gender: details.gender } : {}),
      ...(details.birthDate ? { birthDate: details.birthDate } : {}),
    });

    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Errors | undefined;
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
      <AppHeader notificationsHref="/provider/notifications" />

      <PageContainer className="flex flex-col gap-5 pb-10 pt-4">
        <PageTitle title="ملفي" subtitle="مؤشرات حسابك وبيانات مهنتك وخدمتك الظاهرة للعملاء" />

        {/* ---- مؤشرات لوحة التحكم السابقة ---- */}
        {dashboard.isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-16 w-full rounded-card" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-card" />
              ))}
            </div>
            <Skeleton className="h-24 w-full rounded-card" />
          </div>
        ) : dashboard.isError || !dashboard.data ? (
          <ErrorState message="تعذّر تحميل مؤشراتك" onRetry={() => void dashboard.refetch()} />
        ) : (
          <DashboardSummary
            provider={dashboard.data.provider}
            kpis={dashboard.data.kpis}
          />
        )}

        {/* ---- بيانات المهنة والخدمة ---- */}
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
              <InfoAlert tone="success" title="تم الحفظ">
                تم تحديث ملفك الشخصي بنجاح.
              </InfoAlert>
            )}

            {saveError && (
              <InfoAlert tone="danger" title="تعذّر الحفظ">
                {saveError}
              </InfoAlert>
            )}

            <CompleteProfileCard
              completion={profile.data.profileCompletion}
              tasks={buildCompletionTasks(profile.data)}
            />

            <ProfessionStep
              values={values}
              errors={errors}
              lockProfession={lockProfession}
              fieldIds={{
                years: PROFILE_FIELD_IDS.years,
                bio: PROFILE_FIELD_IDS.bio,
                coverage: PROFILE_FIELD_IDS.coverage,
              }}
              onChange={(patch) => {
                setSaved(false);
                setValues((current) => ({ ...current, ...patch }));
              }}
            />

            {/*
              * فوق زر الحفظ لا تحته: الإضافة والحذف يحفظان فورًا بنداء
              * مستقل، فوضعه بعد زر «حفظ التعديلات» يوحي بأنه ينتظره.
              */}
            <div id={PROFILE_FIELD_IDS.portfolio}>
              <PortfolioSection items={profile.data.portfolio} />
            </div>

            <ProviderDetailsSection
              values={details}
              errors={errors}
              addressId={PROFILE_FIELD_IDS.address}
              onChange={(patch) => {
                setSaved(false);
                setDetails((current) => ({ ...current, ...patch }));
              }}
            />

            <Button
              fullWidth
              loading={updateMutation.isPending}
              onClick={() => void save()}
              iconStart={<Save size={20} />}
            >
              حفظ التعديلات
            </Button>
          </>
        )}

        {/* ---- أدوات مقدم الخدمة ---- */}
        <section aria-label="أدوات مقدم الخدمة">
          <SectionHeader title="أدوات مقدم الخدمة" className="mb-3" />
          <div className="grid grid-cols-3 gap-2">
            <ToolTile href="/provider/services" icon={<Wrench size={22} />} label="خدماتي" />
            <ToolTile href="/provider/reviews" icon={<Star size={22} />} label="التقييمات" />
            <ToolTile href="/provider/account" icon={<Settings size={22} />} label="الإعدادات" />
          </div>
        </section>
      </PageContainer>

      <BottomNav variant="provider" />
    </>
  );
}

/* ---- عناصر داخلية ---- */

function DashboardSummary({
  provider,
  kpis,
}: {
  provider: { isActive: boolean };
  kpis: { rating: number; ratingCount: number; servicesCount: number };
}) {
  return (
    <div className="flex flex-col gap-4">
      {provider.isActive ? (
        <InfoAlert tone="success" title="حسابك مفعّل">
          ملفك ظاهر للعملاء ويمكنهم التواصل معك مباشرة بالهاتف أو واتساب.
        </InfoAlert>
      ) : (
        <InfoAlert tone="warning" title="حسابك غير مفعّل">
          ملفك لا يظهر للعملاء حاليًا. أكمل تسجيلك أو تواصل مع الدعم.
        </InfoAlert>
      )}

      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          icon={<Star size={20} />}
          label="التقييم"
          value={formatRating(kpis.rating)}
          tone="star"
        />
        <KpiCard
          icon={<MessageSquareQuote size={20} />}
          label="التقييمات"
          value={formatNumber(kpis.ratingCount)}
          tone="success"
        />
        <KpiCard
          icon={<Wrench size={20} />}
          label="خدماتي"
          value={formatNumber(kpis.servicesCount)}
          tone="brand"
        />
      </div>

    </div>
  );
}

const KPI_TONES = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-bg text-success',
  star: 'bg-warning-bg text-star',
} as const;

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof KPI_TONES;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <span
        className={cn('flex size-10 items-center justify-center rounded-full', KPI_TONES[tone])}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="num text-[28px] font-extrabold leading-none text-ink-900">{value}</span>
      <span className="text-meta text-ink-400">{label}</span>
    </Card>
  );
}

function ToolTile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-field border border-border bg-surface p-3 text-center transition-colors hover:bg-brand-50"
    >
      <span className="text-brand-600">{icon}</span>
      <span className="text-[11px] font-semibold leading-tight text-ink-700">{label}</span>
    </Link>
  );
}
