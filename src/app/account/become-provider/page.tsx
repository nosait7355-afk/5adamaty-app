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
import {
  BasicInfoStep,
  EMPTY_BASIC_INFO,
  type BasicInfoValues,
} from '@/components/features/provider/basic-info-step';
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
import { convertToProviderSchema, providerStep2Schema } from '@/shared/schemas/provider.schema';

/**
 * التسجيل كمقدم خدمة من حساب عميل قائم.
 *
 * يعيد استخدام خطوات معالج التسجيل نفسها، بفارقين:
 *   - `BasicInfoStep` بوضع `convert`: بلا كلمة مرور ولا بريد (كلاهما في
 *     الحساب أصلًا)، ومع الهاتف لأنه قد يكون ناقصًا.
 *   - الحساب موجود، فلا إنشاء ولا جلسة جديدة هنا.
 *
 * ⚠️ الدور لا يتغيّر إلا عند **نجاح الإرسال** في الخطوة الثالثة. قبل ذلك
 * يظل المستخدم عميلًا كامل الصلاحيات، فمن يتوقف في المنتصف لا يخسر شيئًا
 * ويجد مسودته في انتظاره حين يعود.
 */

const STEPS = [
  { label: 'البيانات الناقصة' },
  { label: 'المهنة والخدمة' },
  { label: 'المستندات' },
];

type Errors = Record<string, string>;

export default function BecomeProviderPage() {
  const router = useRouter();

  const account = useAccountSummary();
  const profile = useMyProviderProfile();
  const becomeMutation = useBecomeProvider();
  const submitMutation = useSubmitVerification();

  const [step, setStep] = useState(1);
  const [basic, setBasic] = useState<BasicInfoValues>(EMPTY_BASIC_INFO);
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

    setBasic((current) => ({
      ...current,
      fullName: draft?.user.fullName ?? user?.fullName ?? current.fullName,
      phone: draft?.user.phone ?? user?.phone ?? current.phone,
      whatsapp: draft?.whatsapp ?? current.whatsapp,
      email: draft?.user.email ?? user?.email ?? current.email,
      city: draft?.user.city ?? user?.city ?? current.city,
      addressLine: draft?.user.addressLine ?? user?.addressLine ?? current.addressLine,
      accountType: draft?.accountType ?? current.accountType,
    }));

    if (draft) {
      setProfession((current) => ({
        ...current,
        categoryId: draft.categoryId,
        professionId: draft.professionId,
        yearsOfExperience:
          draft.yearsOfExperience != null ? String(draft.yearsOfExperience) : '',
        bio: draft.bio,
        coverageAreas: draft.coverageAreas,
      }));
      // مسودة قائمة = البيانات مُرسَلة سابقًا، فالناقص هو المستندات
      setStep(3);
    }
  }

  /* ---- التحقق ---- */

  const collectIssues = (issues: { path: PropertyKey[]; message: string }[]): Errors => {
    const next: Errors = {};
    for (const issue of issues) {
      const key = String(issue.path[0] ?? '_');
      next[key] ??= issue.message;
    }
    return next;
  };

  const validateStep1 = useCallback((): boolean => {
    /*
     * نتحقق من حقول الخطوة الأولى فقط، فنُمرّر قيمًا صالحة مؤقتة لحقول
     * الخطوة الثانية — المخطط واحد لأن الإرسال للخادم يتم دفعةً واحدة.
     */
    const result = convertToProviderSchema.safeParse({
      fullName: basic.fullName,
      phone: basic.phone,
      whatsapp: basic.whatsapp,
      city: basic.city,
      addressLine: basic.addressLine,
      accountType: basic.accountType,
      ...(basic.gender ? { gender: basic.gender } : {}),
      ...(basic.birthDate ? { birthDate: basic.birthDate } : {}),
      categoryId: '000000000000000000000000',
      professionId: '000000000000000000000000',
      yearsOfExperience: '',
      bio: '',
      coverageAreas: ['الفيوم'],
    });

    if (result.success) {
      setErrors({});
      return true;
    }

    const found = collectIssues(result.error.issues);
    const step1Keys = [
      'fullName',
      'phone',
      'whatsapp',
      'city',
      'addressLine',
      'accountType',
      'gender',
      'birthDate',
    ];
    const relevant = Object.fromEntries(
      Object.entries(found).filter(([key]) => step1Keys.includes(key))
    );

    setErrors(relevant);
    return Object.keys(relevant).length === 0;
  }, [basic]);

  const validateStep2 = useCallback((): boolean => {
    const result = providerStep2Schema.safeParse({
      categoryId: profession.categoryId,
      professionId: profession.professionId,
      yearsOfExperience: profession.yearsOfExperience,
      bio: profession.bio,
      coverageAreas: profession.coverageAreas,
    });

    if (result.success) {
      setErrors({});
      return true;
    }
    setErrors(collectIssues(result.error.issues));
    return false;
  }, [profession]);

  /* ---- الإجراءات ---- */

  /** ينشئ ملف المزوّد (مسودة) ثم ينتقل لرفع المستندات. */
  const createDraft = useCallback(async () => {
    setSubmitError('');
    if (!validateStep2()) return;

    try {
      await becomeMutation.mutateAsync({
        fullName: basic.fullName,
        phone: basic.phone,
        whatsapp: basic.whatsapp,
        city: basic.city as never,
        addressLine: basic.addressLine,
        accountType: basic.accountType as never,
        ...(basic.gender ? { gender: basic.gender as never } : {}),
        ...(basic.birthDate ? { birthDate: basic.birthDate } : {}),
        categoryId: profession.categoryId,
        professionId: profession.professionId,
        yearsOfExperience: profession.yearsOfExperience,
        bio: profession.bio,
        coverageAreas: profession.coverageAreas,
      });

      await profile.refetch();
      setStep(3);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message);
        if (error.fields) {
          setErrors(error.fields as Errors);
          // خطأ في بيانات الخطوة الأولى؟ نعيده إليها ليصلحه
          const step1Keys = ['fullName', 'phone', 'whatsapp', 'city', 'addressLine'];
          if (Object.keys(error.fields).some((key) => step1Keys.includes(key))) setStep(1);
        }
      } else {
        setSubmitError('تعذّر حفظ بياناتك. حاول مرة أخرى.');
      }
    }
  }, [basic, profession, becomeMutation, profile, validateStep2]);

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

  return (
    <>
      <BackHeader />

      <PageContainer withBottomNav={false}>
        <PageTitle
          title="التسجيل كمقدم خدمة"
          subtitle={`الخطوة ${step} من 3 — ${STEPS[step - 1]?.label ?? ''}`}
        />

        <Stepper steps={STEPS} current={step} className="mb-6" />

        <InfoAlert tone="info" className="mb-4">
          حسابك الحالي يبقى كما هو — مفضّلتك وعناوينك وطلباتك محفوظة. يتحوّل إلى حساب مقدم خدمة
          بعد إرسال الطلب في الخطوة الأخيرة.
        </InfoAlert>

        {step === 1 && (
          <BasicInfoStep
            values={basic}
            errors={errors}
            mode="convert"
            onChange={(patch) => setBasic((current) => ({ ...current, ...patch }))}
          />
        )}

        {step === 2 && (
          <ProfessionStep
            values={profession}
            errors={errors}
            onChange={(patch) => setProfession((current) => ({ ...current, ...patch }))}
          />
        )}

        {step === 3 &&
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

        {step === 3 && hasDraft && !documents.isComplete && documents.missingRequired.length > 0 && (
          <p className="mt-6 text-meta font-semibold text-danger" role="status">
            لا يمكن الإرسال قبل رفع: {documents.missingRequired.join('، ')}
          </p>
        )}

        {step === 3 && (
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
          {step > 1 && (
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                setErrors({});
                setSubmitError('');
                setStep((current) => current - 1);
              }}
              iconStart={<ArrowRight size={20} />}
            >
              السابق
            </Button>
          )}

          {step === 1 && (
            <Button
              fullWidth
              disabled={busy}
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
              iconEnd={<ArrowLeft size={20} />}
            >
              التالي
            </Button>
          )}

          {step === 2 && (
            <Button
              className="flex-[2]"
              loading={becomeMutation.isPending}
              onClick={() => void createDraft()}
              iconEnd={<ArrowLeft size={20} />}
            >
              التالي
            </Button>
          )}

          {step === 3 && (
            <Button
              className="flex-[2]"
              loading={submitMutation.isPending}
              disabled={!documents.isComplete || !accepted || busy}
              onClick={() => void submitRequest()}
              iconEnd={<Send size={20} />}
            >
              إرسال والتحوّل لمقدم خدمة
            </Button>
          )}
        </div>
      </PageContainer>
    </>
  );
}
