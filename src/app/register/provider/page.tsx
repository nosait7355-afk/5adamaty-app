'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Chrome, Send } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/common/stepper';
import { InfoAlert } from '@/components/common/info-alert';
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
import { extractErrorMessage } from '@/lib/queries/auth';
import {
  useMyProviderProfile,
  useRegisterProvider,
  useSubmitVerification,
} from '@/lib/queries/provider';
import { signInWithGoogle } from '@/lib/google-social-login';
import {
  providerStep1Schema,
  providerStep2Schema,
} from '@/shared/schemas/provider.schema';
import { GOOGLE_SIGN_IN_ENABLED } from '@/shared/constants/feature-flags';

/**
 * معالج تسجيل مقدم الخدمة — الصور 19 إلى 21.
 *
 * المعالج يعبر حدّ المصادقة في منتصفه: الحساب يُنشأ عند الانتقال من 2 إلى 3
 * لأن رفع المستندات يتطلب جلسة وملف مزوّد. لذلك:
 *   - الخطوتان 1 و2 تُحفظان محليًا (مسودة) ويمكن العودة إليهما بحرية.
 *   - بعد إنشاء الحساب تصير الخطوتان 1 و2 للعرض والتعديل عبر الـAPI.
 *
 * خطوة «مراجعة الطلب» أُزيلت: الإرسال يتم من خطوة المستندات مباشرة،
 * والحساب يُفعَّل تلقائيًا بعده.
 */

const STEPS = [
  { label: 'البيانات الأساسية' },
  { label: 'المهنة والخدمة' },
  { label: 'المستندات' },
];

const DRAFT_KEY = 'khadamaty:provider-draft';

interface Draft {
  step: number;
  basic: Omit<BasicInfoValues, 'password' | 'confirmPassword'>;
  profession: ProfessionValues;
}

type Errors = Record<string, string>;

export default function ProviderRegistrationPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [basic, setBasic] = useState<BasicInfoValues>(EMPTY_BASIC_INFO);
  const [profession, setProfession] = useState<ProfessionValues>(EMPTY_PROFESSION);
  const [errors, setErrors] = useState<Errors>({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [googleFillPending, setGoogleFillPending] = useState(false);
  const [googleFillError, setGoogleFillError] = useState('');

  const registerMutation = useRegisterProvider();
  const submitMutation = useSubmitVerification();

  /*
   * الحساب موجود؟ نقرأ ملفه. `retry: false` مقصود: الزائر في الخطوة 1 يتلقى
   * 401 وهو الوضع الطبيعي، فلا معنى لإعادة المحاولة.
   */
  const profile = useMyProviderProfile();
  const hasAccount = Boolean(profile.data);

  /**
   * تعبئة تلقائية للاسم والبريد من جوجل — لا تُنشئ حسابًا ولا جلسة.
   * الحساب الفعلي لمقدم الخدمة يُنشأ لاحقًا بالمسار المعتاد (هاتف + كلمة
   * مرور) عند الانتقال من الخطوة 2 إلى 3، كما هو الحال بلا جوجل تمامًا.
   */
  const fillFromGoogle = async () => {
    setGoogleFillError('');
    setGoogleFillPending(true);
    try {
      const { fullName, email } = await signInWithGoogle();
      setBasic((current) => ({
        ...current,
        ...(fullName ? { fullName } : {}),
        ...(email ? { email } : {}),
      }));
    } catch (fillError) {
      setGoogleFillError(extractErrorMessage(fillError));
    } finally {
      setGoogleFillPending(false);
    }
  };

  /* ---- استعادة المسودة ---- */
  /*
   * قراءة `localStorage` لا يمكن أن تحدث أثناء الرسم: الخادم يرسم هذه الصفحة
   * أولًا ولا وجود لـ`window` عنده، وتغيير الحالة أثناء أول رسم على العميل
   * يكسر الترطيب (hydration). فهي حالة «القراءة من نظام خارجي» التي تستثنيها
   * قاعدة set-state-in-effect، وتعمل مرة واحدة بحارس مرجعي.
   */
  const draftRestoredRef = useRef(false);

  useEffect(() => {
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(DRAFT_KEY);
    } catch {
      // تخزين معطّل (تصفّح خاص) — نكمل بلا مسودة
    }
    if (!raw) {
      setDraftRestored(true);
      return;
    }

    try {
      const draft = JSON.parse(raw) as Draft;
      setBasic((current) => ({ ...current, ...draft.basic }));
      setProfession((current) => ({ ...current, ...draft.profession }));
      if (draft.step >= 1 && draft.step <= 2) setStep(draft.step);
    } catch {
      // مسودة تالفة — نتجاهلها بدل كسر الشاشة
      window.localStorage.removeItem(DRAFT_KEY);
    }

    setDraftRestored(true);
  }, []);

  /* ---- الحفظ التلقائي ---- */
  useEffect(() => {
    if (!draftRestored || hasAccount) return;

    /*
     * كلمة المرور **لا تُحفظ** إطلاقًا: المسودة تعيش في localStorage الذي
     * تقرأه أي شيفرة تعمل على الصفحة، وحفظ كلمة مرور نصية فيه يحوّل ثغرة
     * XSS عابرة إلى تسريب دائم لبيانات الدخول.
     */
    const { password: _password, confirmPassword: _confirm, ...safeBasic } = basic;

    const draft: Draft = { step, basic: safeBasic, profession };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // امتلاء التخزين لا يجب أن يعطّل المعالج
    }
  }, [basic, profession, step, draftRestored, hasAccount]);

  /* ---- مزامنة الملف بعد إنشاء الحساب ---- */
  /*
   * نمط «تعديل الحالة أثناء الرسم» الموثّق في React بدل `useEffect`: عندما
   * يصل ملف جديد من الخادم نملأ به النموذج مرة واحدة. المفتاح يمنع الطمس
   * المتكرر لما يكتبه المستخدم بعد المزامنة الأولى.
   */
  const [syncedProfileId, setSyncedProfileId] = useState<string | null>(null);

  if (profile.data && profile.data.id !== syncedProfileId) {
    const loaded = profile.data;
    setSyncedProfileId(loaded.id);

    /*
     * استئناف من حالة الخادم عند العودة للمعالج (إعادة تحميل، أو رجوع بعد
     * أيام، أو طلب إعادة إرسال). المسودة المحلية تُمسح فور إنشاء الحساب،
     * فالخادم هو مصدر الحقيقة الوحيد بعدها: أي طلب لم يُرسل يستأنف من
     * خطوة المستندات، وهي الخطوة الأخيرة التي يتم الإرسال منها.
     */
    if (loaded.verification.status === 'DRAFT' || loaded.verification.status === 'RESUBMISSION_REQUIRED') {
      setStep(3);
    }

    setBasic((current) => ({
      ...current,
      fullName: loaded.user.fullName,
      phone: loaded.user.phone ?? current.phone,
      email: loaded.user.email ?? current.email,
      city: loaded.user.city ?? current.city,
      addressLine: loaded.user.addressLine ?? current.addressLine,
    }));

    setProfession((current) => ({
      ...current,
      categoryId: loaded.categoryId,
      professionId: loaded.professionId,
      yearsOfExperience: String(loaded.yearsOfExperience),
      bio: loaded.bio,
      coverageAreas: loaded.coverageAreas,
    }));
  }

  /* ---- التحقق لكل خطوة ---- */

  const validateStep1 = useCallback((): boolean => {
    const result = providerStep1Schema.safeParse({
      fullName: basic.fullName,
      phone: basic.phone,
      email: basic.email,
      password: basic.password,
      confirmPassword: basic.confirmPassword,
      city: basic.city,
      addressLine: basic.addressLine,
      accountType: basic.accountType,
      ...(basic.gender ? { gender: basic.gender } : {}),
      ...(basic.birthDate ? { birthDate: basic.birthDate } : {}),
    });

    if (result.success) {
      setErrors({});
      return true;
    }

    const next: Errors = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? '_');
      next[key] ??= issue.message;
    }
    setErrors(next);
    return false;
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

    const next: Errors = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? '_');
      next[key] ??= issue.message;
    }
    setErrors(next);
    return false;
  }, [profession]);

  /* ---- الانتقال ---- */

  const goToStep3 = useCallback(async () => {
    if (!validateStep2()) return;

    // الحساب موجود بالفعل (عودة للمعالج أو إعادة إرسال) — لا نُنشئ حسابًا ثانيًا
    if (hasAccount) {
      setStep(3);
      return;
    }

    setSubmitError('');
    try {
      await registerMutation.mutateAsync({
        step1: {
          fullName: basic.fullName,
          phone: basic.phone,
          email: basic.email,
          password: basic.password,
          confirmPassword: basic.confirmPassword,
          city: basic.city as never,
          addressLine: basic.addressLine,
          accountType: basic.accountType as never,
          ...(basic.gender ? { gender: basic.gender as never } : {}),
          ...(basic.birthDate ? { birthDate: basic.birthDate } : {}),
        },
        step2: {
          categoryId: profession.categoryId,
          professionId: profession.professionId,
          yearsOfExperience: Number(profession.yearsOfExperience),
          bio: profession.bio,
          coverageAreas: profession.coverageAreas,
        },
      });

      // الحساب أُنشئ — المسودة المحلية لم تعد مصدر الحقيقة
      window.localStorage.removeItem(DRAFT_KEY);
      await profile.refetch();
      setStep(3);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message);
        if (error.fields) {
          const next: Errors = {};
          for (const [path, message] of Object.entries(error.fields)) {
            next[path.replace(/^step[12]\./, '')] = message;
          }
          setErrors(next);
          // الخطأ في بيانات الخطوة الأولى؟ نعيده إليها ليصلحها
          if (Object.keys(error.fields).some((key) => key.startsWith('step1.'))) setStep(1);
        }
      } else {
        setSubmitError('تعذّر إنشاء الحساب. حاول مرة أخرى.');
      }
    }
  }, [basic, profession, hasAccount, registerMutation, profile, validateStep2]);

  const submitRequest = useCallback(async () => {
    setSubmitError('');
    try {
      await submitMutation.mutateAsync();
      router.push('/provider/pending-review');
    } catch (error) {
      setSubmitError(
        error instanceof ApiClientError ? error.message : 'تعذّر إرسال الطلب. حاول مرة أخرى.'
      );
    }
  }, [submitMutation, router]);

  /* ---- العرض ---- */

  const documents = profile.data?.documents ?? {
    uploaded: 0,
    requiredTotal: 0,
    missingRequired: [],
    isComplete: false,
  };

  const busy = registerMutation.isPending || submitMutation.isPending;

  return (
    <>
      <BackHeader />

      <PageContainer withBottomNav={false}>
        <PageTitle
          title="تسجيل مقدم خدمة"
          subtitle={`الخطوة ${step} من 3 — ${STEPS[step - 1]?.label ?? ''}`}
        />

        <Stepper steps={STEPS} current={step} className="mb-6" />

        {profile.data?.verification.status === 'RESUBMISSION_REQUIRED' && (
          <InfoAlert tone="warning" title="مطلوب تعديل الطلب" className="mb-4">
            {profile.data.verification.rejectionReason ??
              'راجعت الإدارة طلبك وطلبت تعديلًا قبل إعادة الإرسال.'}
          </InfoAlert>
        )}

        {step === 1 && (
          <>
            {GOOGLE_SIGN_IN_ENABLED && !hasAccount && (
              <div className="mb-4 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  loading={googleFillPending}
                  onClick={() => void fillFromGoogle()}
                  iconStart={<Chrome size={20} />}
                >
                  تعبئة الاسم والبريد من جوجل
                </Button>
                {googleFillError && (
                  <p className="text-badge text-danger" role="alert">
                    {googleFillError}
                  </p>
                )}
              </div>
            )}

            <BasicInfoStep
              values={basic}
              errors={errors}
              mode={hasAccount ? 'edit' : 'create'}
              onChange={(patch) => setBasic((current) => ({ ...current, ...patch }))}
            />
          </>
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
              persist={hasAccount}
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

        {step === 3 && (
          <p className="mt-6 text-meta text-ink-400">
            بإرسال الطلب تُقرّ بأن جميع البيانات والمستندات المرفقة صحيحة وتخصّك، وتوافق على{' '}
            <span className="font-semibold text-brand-600">الشروط والأحكام</span> و
            <span className="font-semibold text-brand-600">سياسة الخصوصية</span>.
          </p>
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
                if (hasAccount || validateStep1()) setStep(2);
              }}
              iconEnd={<ArrowLeft size={20} />}
            >
              التالي
            </Button>
          )}

          {step === 2 && (
            <Button
              className="flex-[2]"
              loading={registerMutation.isPending}
              onClick={() => void goToStep3()}
              iconEnd={<ArrowLeft size={20} />}
            >
              التالي
            </Button>
          )}

          {step === 3 && (
            <Button
              className="flex-[2]"
              loading={submitMutation.isPending}
              disabled={!documents.isComplete || busy}
              onClick={() => void submitRequest()}
              iconEnd={<Send size={20} />}
            >
              إرسال طلب التسجيل
            </Button>
          )}
        </div>
      </PageContainer>
    </>
  );
}
