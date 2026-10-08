'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Stepper } from '@/components/common/stepper';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import { EMPTY_BASIC_INFO } from '@/components/features/provider/basic-info-step';
import {
  QuickInfoStep,
  toWhatsappDigits,
  type QuickInfoValues,
} from '@/components/features/provider/quick-info-step';
import {
  EMPTY_PROFESSION,
  ProfessionStep,
  type ProfessionValues,
} from '@/components/features/provider/profession-step';
import { DocumentsStep } from '@/components/features/provider/documents-step';
import { ApiClientError } from '@/lib/api-client';
import { useAccountSummary } from '@/lib/queries/account';
import {
  useBecomeProvider,
  useMyProviderProfile,
  useSubmitVerification,
} from '@/lib/queries/provider';
import { convertToProviderSchema } from '@/shared/schemas/provider.schema';
import { isValidCoverageArea } from '@/shared/constants/fayoum-areas';

/**
 * التسجيل كمقدم خدمة من حساب قائم — وهو أيضًا مسار التسجيل السريع: زر
 * جوجل في `/register/provider` ينشئ حساب عميل ثم يحوّل إلى هنا.
 *
 * خطوتان فقط، بالحد الأدنى اللازم ليظهر مقدم الخدمة للعملاء:
 *   1. بياناتك ومهنتك: الاسم، الهاتف، الواتساب، المركز، التصنيف والتخصص،
 *      ومناطق التغطية.
 *   2. صورة البطاقة — الشرط الوحيد للتفعيل (`submitVerification`).
 * العنوان التفصيلي وسنوات الخبرة والوصف والنوع وتاريخ الميلاد ونوع الحساب
 * كلها اختيارية وتُكمَل لاحقًا من الملف.
 *
 * ⚠️ الدور لا يتغيّر إلا عند **نجاح الإرسال** في الخطوة الثانية. قبل ذلك
 * يظل المستخدم عميلًا كامل الصلاحيات، فمن يتوقف في المنتصف لا يخسر شيئًا
 * ويجد مسودته في انتظاره حين يعود.
 */

const STEPS = [{ label: 'بياناتك ومهنتك' }, { label: 'صورة البطاقة' }];

const QUICK_INFO_KEYS = ['fullName', 'phone', 'whatsapp', 'city'] as const;

type Errors = Record<string, string>;

const EMPTY_QUICK_INFO: QuickInfoValues = {
  fullName: EMPTY_BASIC_INFO.fullName,
  phone: EMPTY_BASIC_INFO.phone,
  whatsapp: EMPTY_BASIC_INFO.whatsapp,
  city: EMPTY_BASIC_INFO.city,
};

export default function BecomeProviderPage() {
  const router = useRouter();

  const account = useAccountSummary();
  const profile = useMyProviderProfile();
  const becomeMutation = useBecomeProvider();
  const submitMutation = useSubmitVerification();

  const [step, setStep] = useState(1);
  const [info, setInfo] = useState<QuickInfoValues>(EMPTY_QUICK_INFO);
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [profession, setProfession] = useState<ProfessionValues>(EMPTY_PROFESSION);
  const [errors, setErrors] = useState<Errors>({});
  const [accepted, setAccepted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const hasDraft = Boolean(profile.data);

  /*
   * تعبئة النموذج من الحساب مرة واحدة — نمط «تعديل الحالة أثناء الرسم»
   * الموثّق في React بدل `useEffect`. المفتاح يمنع طمس ما يكتبه المستخدم
   * بعد التعبئة الأولى.
   */
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  const seedKey = profile.data?.id ?? account.data?.user.id ?? null;

  if (seedKey && seedKey !== seededFrom) {
    setSeededFrom(seedKey);

    const user = account.data?.user;
    const draft = profile.data;

    const phone = draft?.user.phone ?? user?.phone ?? info.phone;
    const city = draft?.user.city ?? user?.city ?? info.city;
    const savedWhatsapp = draft?.whatsapp;
    const same = !savedWhatsapp || savedWhatsapp === toWhatsappDigits(phone);

    setWhatsappSame(same);
    setInfo({
      fullName: draft?.user.fullName ?? user?.fullName ?? info.fullName,
      phone,
      whatsapp: same ? toWhatsappDigits(phone) : savedWhatsapp,
      city,
    });

    if (draft) {
      setProfession({
        categoryId: draft.categoryId,
        professionId: draft.professionId,
        yearsOfExperience: draft.yearsOfExperience != null ? String(draft.yearsOfExperience) : '',
        bio: draft.bio,
        coverageAreas: draft.coverageAreas,
      });
      // مسودة قائمة = البيانات مُرسَلة سابقًا، فالناقص هو البطاقة
      setStep(2);
    } else if (isValidCoverageArea(city)) {
      // مركزه هو أول منطقة يغطيها غالبًا — يختار غيرها إن شاء
      setProfession((current) => ({ ...current, coverageAreas: [city] }));
    }
  }

  /** تغيير المركز يقترحه منطقة تغطية ما دام لم يختر مناطق بنفسه. */
  const updateInfo = (patch: Partial<QuickInfoValues>) => {
    setInfo((current) => ({ ...current, ...patch }));

    const city = patch.city;
    if (city && isValidCoverageArea(city)) {
      setProfession((current) =>
        current.coverageAreas.length <= 1 ? { ...current, coverageAreas: [city] } : current
      );
    }
  };

  /* ---- التحقق ---- */

  const collectIssues = (issues: { path: PropertyKey[]; message: string }[]): Errors => {
    const next: Errors = {};
    for (const issue of issues) {
      const key = String(issue.path[0] ?? '_');
      next[key] ??= issue.message;
    }
    return next;
  };

  const buildInput = useCallback(
    () => ({
      fullName: info.fullName,
      phone: info.phone,
      whatsapp: whatsappSame ? toWhatsappDigits(info.phone) : info.whatsapp,
      city: info.city,
      categoryId: profession.categoryId,
      professionId: profession.professionId,
      yearsOfExperience: profession.yearsOfExperience,
      bio: profession.bio,
      coverageAreas: profession.coverageAreas,
    }),
    [info, whatsappSame, profession]
  );

  /* ---- الإجراءات ---- */

  /** ينشئ ملف المزوّد (مسودة) ثم ينتقل لرفع البطاقة. */
  const createDraft = useCallback(async () => {
    setSubmitError('');

    const input = buildInput();
    const result = convertToProviderSchema.safeParse(input);
    if (!result.success) {
      const found = collectIssues(result.error.issues);
      // «المعرّف غير صالح» لحقل فارغ رسالة تقنية — المستخدم لم يختر بعد
      if (!input.categoryId && found.categoryId) found.categoryId = 'اختر التصنيف.';
      if (!input.professionId && found.professionId) found.professionId = 'اختر التخصص.';
      setErrors(found);
      return;
    }
    setErrors({});

    try {
      await becomeMutation.mutateAsync({
        ...input,
        city: input.city as never,
      });

      await profile.refetch();
      setStep(2);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message);
        if (error.fields) setErrors(error.fields as Errors);
      } else {
        setSubmitError('تعذّر حفظ بياناتك. حاول مرة أخرى.');
      }
    }
  }, [buildInput, becomeMutation, profile]);

  /** الإرسال — هنا فقط يتحوّل الحساب فعلًا إلى مقدم خدمة. */
  const submitRequest = useCallback(async () => {
    setSubmitError('');
    try {
      await submitMutation.mutateAsync();
      /*
       * `refresh` قبل التنقّل: الدور تغيّر والخادم أصدر كوكيز جلسة جديدة،
       * فلا بد أن يعيد الـRouter قراءة الصفحات من الخادم بالدور الجديد —
       * وإلا استقبله حارس المسار في `proxy.ts` بالدور القديم.
       */
      router.refresh();
      router.push('/provider/profile');
    } catch (error) {
      setSubmitError(
        error instanceof ApiClientError ? error.message : 'تعذّر إرسال الطلب. حاول مرة أخرى.'
      );
    }
  }, [submitMutation, router]);

  /* ---- العرض ---- */

  if (account.isPending) {
    return (
      <>
        <BackHeader />
        <PageContainer withBottomNav={false} className="flex flex-col gap-4 pt-4">
          <Skeleton className="h-10 w-2/3 rounded-field" />
          <Skeleton className="h-12 w-full rounded-field" />
          <Skeleton className="h-12 w-full rounded-field" />
          <Skeleton className="h-32 w-full rounded-card" />
        </PageContainer>
      </>
    );
  }

  if (account.isError || !account.data) {
    return (
      <>
        <BackHeader />
        <PageContainer withBottomNav={false} className="pt-6">
          <ErrorState message="تعذّر تحميل حسابك" onRetry={() => void account.refetch()} />
        </PageContainer>
      </>
    );
  }

  const documents = profile.data?.documents ?? {
    uploaded: 0,
    requiredTotal: 0,
    missingRequired: [],
    isComplete: false,
  };

  const busy = becomeMutation.isPending || submitMutation.isPending;

  const quickInfoErrors = Object.fromEntries(
    Object.entries(errors).filter(([key]) => (QUICK_INFO_KEYS as readonly string[]).includes(key))
  );

  return (
    <>
      <BackHeader />

      <PageContainer withBottomNav={false}>
        <PageTitle
          title="التسجيل كمقدم خدمة"
          subtitle={`الخطوة ${step} من 2 — ${STEPS[step - 1]?.label ?? ''}`}
        />

        <Stepper steps={STEPS} current={step} className="mb-6" />

        {step === 1 && (
          <>
            <InfoAlert tone="info" className="mb-4">
              خطوتان فقط وتبدأ استقبال الطلبات. العنوان التفصيلي ووصف خدمتك وسنوات خبرتك تكملها
              لاحقًا من ملفك.
            </InfoAlert>

            <QuickInfoStep
              values={info}
              errors={quickInfoErrors}
              onChange={updateInfo}
              whatsappSame={whatsappSame}
              onWhatsappSameChange={setWhatsappSame}
            />

            <h2 className="mb-4 mt-6 text-label font-bold text-ink-900">مهنتك</h2>

            <ProfessionStep
              compact
              values={profession}
              errors={errors}
              onChange={(patch) => setProfession((current) => ({ ...current, ...patch }))}
            />
          </>
        )}

        {step === 2 &&
          (profession.professionId ? (
            <DocumentsStep
              professionId={profession.professionId}
              persist={hasDraft}
              onCompletionChange={() => void profile.refetch()}
            />
          ) : (
            <InfoAlert tone="warning" title="لم تُختر المهنة بعد">
              ارجع للخطوة السابقة واختر التصنيف والتخصص لعرض المستندات المطلوبة لمهنتك.
            </InfoAlert>
          ))}

        {submitError && (
          <InfoAlert tone="danger" title="تعذّر إتمام الخطوة" className="mt-4">
            {submitError}
          </InfoAlert>
        )}

        {step === 2 &&
          hasDraft &&
          !documents.isComplete &&
          documents.missingRequired.length > 0 && (
            <p className="mt-6 text-meta font-semibold text-danger" role="status">
              لا يمكن الإرسال قبل رفع: {documents.missingRequired.join('، ')}
            </p>
          )}

        {step === 2 && (
          <Checkbox
            id="become-provider-pledge"
            className="mt-6"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            label={
              <>
                أُقرّ بأن جميع البيانات والمستندات المرفقة صحيحة وتخصّني، وأوافق على{' '}
                <Link href="/terms" target="_blank" className="font-semibold text-brand-600">
                  الشروط والأحكام
                </Link>{' '}
                و
                <Link href="/privacy" target="_blank" className="font-semibold text-brand-600">
                  سياسة الخصوصية
                </Link>
                .
              </>
            }
          />
        )}

        {/* ---- أزرار التنقّل ---- */}
        <div className="mt-4 flex gap-3 pb-8">
          {step === 2 && (
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                setErrors({});
                setSubmitError('');
                setStep(1);
              }}
              iconStart={<ArrowRight size={20} />}
            >
              السابق
            </Button>
          )}

          {step === 1 && (
            <Button
              fullWidth
              loading={becomeMutation.isPending}
              onClick={() => void createDraft()}
              iconEnd={<ArrowLeft size={20} />}
            >
              التالي
            </Button>
          )}

          {step === 2 && (
            <Button
              className="flex-[2]"
              loading={submitMutation.isPending}
              disabled={!documents.isComplete || !accepted || busy}
              onClick={() => void submitRequest()}
              iconEnd={<Send size={20} />}
            >
              ابدأ استقبال الطلبات
            </Button>
          )}
        </div>
      </PageContainer>
    </>
  );
}
