'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Stepper } from '@/components/common/stepper';
import { InfoAlert } from '@/components/common/info-alert';
import { EMPTY_BASIC_INFO } from '@/components/features/provider/basic-info-step';
import {
  QuickInfoStep,
  toWhatsappDigits,
  type QuickInfoValues,
} from '@/components/features/provider/quick-info-step';
import {
  CredentialsFields,
  type CredentialsValues,
} from '@/components/features/provider/credentials-fields';
import {
  EMPTY_PROFESSION,
  ProfessionStep,
  type ProfessionValues,
} from '@/components/features/provider/profession-step';
import { DocumentsStep } from '@/components/features/provider/documents-step';
import { ApiClientError } from '@/lib/api-client';
import { resolveHomeRoute } from '@/lib/queries/auth';
import { GoogleSignInButton } from '@/components/features/auth/google-sign-in-button';
import type { AuthUserDto } from '@/server/services/auth.service';
import {
  useMyProviderProfile,
  useRegisterProvider,
  useSubmitVerification,
  useUpdateProviderProfile,
} from '@/lib/queries/provider';
import {
  providerStep1Schema,
  providerStep2Schema,
} from '@/shared/schemas/provider.schema';
import { GOOGLE_SIGN_IN_ENABLED } from '@/shared/constants/feature-flags';
import { isValidCoverageArea } from '@/shared/constants/fayoum-areas';

/**
 * تسجيل مقدم الخدمة بالهاتف وكلمة المرور — نفس شاشتي مسار جوجل
 * (`/account/become-provider`) بالحقول نفسها، والفرق الوحيد البريد وكلمة
 * المرور وتأكيدها في الشاشة الأولى:
 *   1. بياناتك ومهنتك: الاسم، الهاتف، الواتساب، المركز، بيانات الدخول،
 *      التصنيف والتخصص، ومناطق التغطية.
 *   2. صورة البطاقة + الإقرار ← تفعيل تلقائي.
 * العنوان التفصيلي والنوع وتاريخ الميلاد ونوع الحساب وسنوات الخبرة والوصف
 * تُكمَل لاحقًا من «كمّل ملفك».
 *
 * المعالج يعبر حدّ المصادقة بين الشاشتين: الحساب يُنشأ عند مغادرة الأولى
 * لأن رفع البطاقة يتطلب جلسة وملف مزوّد. لذلك الشاشة الأولى تُحفظ محليًا
 * (مسودة)، وبعد إنشاء الحساب يصير الخادم مصدر الحقيقة وتُعدَّل عبر الـAPI.
 */

const STEPS = [{ label: 'بياناتك ومهنتك' }, { label: 'صورة البطاقة' }];

const DRAFT_KEY = 'khadamaty:provider-draft';

const QUICK_INFO_KEYS = ['fullName', 'phone', 'whatsapp', 'city'] as const;
const CREDENTIALS_KEYS = ['email', 'password', 'confirmPassword'] as const;

/** كلمة المرور **لا تُحفظ** في المسودة — انظر الحفظ التلقائي أدناه. */
interface Draft {
  info: QuickInfoValues;
  whatsappSame: boolean;
  email: string;
  profession: ProfessionValues;
}

type Errors = Record<string, string>;

const EMPTY_QUICK_INFO: QuickInfoValues = {
  fullName: EMPTY_BASIC_INFO.fullName,
  phone: EMPTY_BASIC_INFO.phone,
  whatsapp: EMPTY_BASIC_INFO.whatsapp,
  city: EMPTY_BASIC_INFO.city,
};

const EMPTY_CREDENTIALS: CredentialsValues = { email: '', password: '', confirmPassword: '' };

/** يحصر الأخطاء في مفاتيح مكوّن واحد — كل مكوّن يعرض حقوله فقط. */
function pickErrors(errors: Errors, keys: readonly string[]): Errors {
  return Object.fromEntries(Object.entries(errors).filter(([key]) => keys.includes(key)));
}

function collectIssues(issues: { path: PropertyKey[]; message: string }[]): Errors {
  const next: Errors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '_');
    next[key] ??= issue.message;
  }
  return next;
}

export default function ProviderRegistrationPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [info, setInfo] = useState<QuickInfoValues>(EMPTY_QUICK_INFO);
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [credentials, setCredentials] = useState<CredentialsValues>(EMPTY_CREDENTIALS);
  const [profession, setProfession] = useState<ProfessionValues>(() => ({
    ...EMPTY_PROFESSION,
    // مركزه هو أول منطقة يغطيها غالبًا — يختار غيرها إن شاء
    coverageAreas: isValidCoverageArea(EMPTY_QUICK_INFO.city) ? [EMPTY_QUICK_INFO.city] : [],
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [accepted, setAccepted] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const registerMutation = useRegisterProvider();
  const updateMutation = useUpdateProviderProfile();
  const submitMutation = useSubmitVerification();

  /*
   * الحساب موجود؟ نقرأ ملفه. `retry: false` مقصود: الزائر في الخطوة 1 يتلقى
   * 401 وهو الوضع الطبيعي، فلا معنى لإعادة المحاولة.
   */
  const profile = useMyProviderProfile();
  const hasAccount = Boolean(profile.data);

  /**
   * التسجيل السريع عبر جوجل: ينشئ حساب عميل (أو يدخل لحساب قائم بنفس
   * البريد) ثم يكمل في `/account/become-provider` — نفس الشاشتين بلا كلمة
   * مرور. الدور يتحوّل إلى PROVIDER عند إرسال البطاقة كما في التحويل العادي.
   */
  const continueWithGoogle = (user: AuthUserDto) => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // تخزين معطّل — لا مسودة لمسحها
    }
    router.refresh();
    router.replace(user.role === 'CUSTOMER' ? '/account/become-provider' : resolveHomeRoute(user));
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
      /*
       * مسودات المعالج القديم (ثلاث خطوات) تحمل `basic` بدل `info` — نأخذ
       * منها ما يخص الشاشة الجديدة كي لا يخسر من بدأ قبل التحديث ما كتبه.
       */
      const draft = JSON.parse(raw) as Partial<Draft> & {
        basic?: Partial<QuickInfoValues> & { email?: string };
      };
      const saved = { ...draft.basic, ...draft.info };

      const restored: QuickInfoValues = {
        fullName: saved.fullName ?? EMPTY_QUICK_INFO.fullName,
        phone: saved.phone ?? EMPTY_QUICK_INFO.phone,
        whatsapp: saved.whatsapp ?? EMPTY_QUICK_INFO.whatsapp,
        city: saved.city ?? EMPTY_QUICK_INFO.city,
      };
      setInfo(restored);
      setWhatsappSame(
        draft.whatsappSame ??
          (!restored.whatsapp || restored.whatsapp === toWhatsappDigits(restored.phone))
      );
      setCredentials((current) => ({
        ...current,
        email: draft.email ?? draft.basic?.email ?? '',
      }));
      if (draft.profession) {
        setProfession((current) => ({ ...current, ...draft.profession }));
      }
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
    const draft: Draft = { info, whatsappSame, email: credentials.email, profession };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // امتلاء التخزين لا يجب أن يعطّل المعالج
    }
  }, [info, whatsappSame, credentials.email, profession, draftRestored, hasAccount]);

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
     * شاشة البطاقة، وهي التي يتم الإرسال منها.
     */
    if (
      loaded.verification.status === 'DRAFT' ||
      loaded.verification.status === 'RESUBMISSION_REQUIRED'
    ) {
      setStep(2);
    }

    const phone = loaded.user.phone ?? info.phone;
    const same = !loaded.whatsapp || loaded.whatsapp === toWhatsappDigits(phone);

    setWhatsappSame(same);
    setInfo({
      fullName: loaded.user.fullName,
      phone,
      whatsapp: same ? toWhatsappDigits(phone) : (loaded.whatsapp ?? ''),
      city: loaded.user.city ?? info.city,
    });
    setCredentials({ ...EMPTY_CREDENTIALS, email: loaded.user.email ?? credentials.email });
    setProfession({
      categoryId: loaded.categoryId,
      professionId: loaded.professionId,
      yearsOfExperience: loaded.yearsOfExperience != null ? String(loaded.yearsOfExperience) : '',
      bio: loaded.bio,
      coverageAreas: loaded.coverageAreas,
    });
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

  const whatsapp = whatsappSame ? toWhatsappDigits(info.phone) : info.whatsapp;

  /** يتحقق من الشاشة الأولى كلها دفعة واحدة — بالمخططين اللذين يطبّقهما الخادم. */
  const validateStep1 = useCallback((): boolean => {
    const basic = providerStep1Schema.safeParse({
      fullName: info.fullName,
      phone: info.phone,
      whatsapp,
      email: credentials.email,
      password: credentials.password,
      confirmPassword: credentials.confirmPassword,
      city: info.city,
    });
    const job = providerStep2Schema.safeParse({
      categoryId: profession.categoryId,
      professionId: profession.professionId,
      coverageAreas: profession.coverageAreas,
      bio: profession.bio,
      yearsOfExperience: profession.yearsOfExperience,
    });

    const found: Errors = {
      ...(basic.success ? {} : collectIssues(basic.error.issues)),
      ...(job.success ? {} : collectIssues(job.error.issues)),
    };
    // بعد إنشاء الحساب لا كلمة مرور في النموذج — نتحقق من الباقي فقط
    if (hasAccount) {
      delete found.password;
      delete found.confirmPassword;
    }
    // «المعرّف غير صالح» لحقل فارغ رسالة تقنية — المستخدم لم يختر بعد
    if (!profession.categoryId && found.categoryId) found.categoryId = 'اختر التصنيف.';
    if (!profession.professionId && found.professionId) found.professionId = 'اختر التخصص.';

    setErrors(found);
    return Object.keys(found).length === 0;
  }, [info, whatsapp, credentials, profession, hasAccount]);

  /* ---- الإجراءات ---- */

  /** ينشئ الحساب (أو يحفظ تعديلات حساب قائم) ثم ينتقل لرفع البطاقة. */
  const goToStep2 = useCallback(async () => {
    setSubmitError('');
    if (!validateStep1()) return;

    const status = profile.data?.verification.status;

    try {
      if (hasAccount) {
        // عودة للمعالج بعد إنشاء الحساب — التعديل يُحفظ ولا يُنشأ حساب ثانٍ
        if (status === 'DRAFT' || status === 'RESUBMISSION_REQUIRED') {
          await updateMutation.mutateAsync({
            fullName: info.fullName,
            email: credentials.email,
            whatsapp,
            city: info.city,
            categoryId: profession.categoryId,
            professionId: profession.professionId,
            coverageAreas: profession.coverageAreas,
          });
        }
        setStep(2);
        return;
      }

      await registerMutation.mutateAsync({
        step1: {
          fullName: info.fullName,
          phone: info.phone,
          whatsapp,
          email: credentials.email,
          password: credentials.password,
          confirmPassword: credentials.confirmPassword,
          city: info.city as never,
        },
        step2: {
          categoryId: profession.categoryId,
          professionId: profession.professionId,
          bio: '',
          coverageAreas: profession.coverageAreas,
        },
      });

      // الحساب أُنشئ — المسودة المحلية لم تعد مصدر الحقيقة
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // تخزين معطّل — لا مسودة لمسحها
      }
      await profile.refetch();
      setStep(2);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message);
        if (error.fields) {
          // الخادم يعيد مسارات مثل `step1.email` — الشاشة واحدة فيكفي اسم الحقل
          const next: Errors = {};
          for (const [path, message] of Object.entries(error.fields)) {
            next[path.replace(/^step[12]\./, '')] = message;
          }
          setErrors(next);
        }
      } else {
        setSubmitError(
          hasAccount ? 'تعذّر حفظ بياناتك. حاول مرة أخرى.' : 'تعذّر إنشاء الحساب. حاول مرة أخرى.'
        );
      }
    }
  }, [
    validateStep1,
    hasAccount,
    profile,
    updateMutation,
    registerMutation,
    info,
    whatsapp,
    credentials,
    profession,
  ]);

  /** الإرسال — يفعّل الحساب تلقائيًا، ثم الملف حيث «كمّل ملفك». */
  const submitRequest = useCallback(async () => {
    setSubmitError('');
    try {
      await submitMutation.mutateAsync();
      /*
       * `refresh` قبل التنقّل: الحالة تغيّرت والخادم أصدر كوكيز جلسة جديدة،
       * فلا بد أن يعيد الـRouter قراءة الصفحات من الخادم بالحالة الجديدة.
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

  const documents = profile.data?.documents ?? {
    uploaded: 0,
    requiredTotal: 0,
    missingRequired: [],
    isComplete: false,
  };

  const busy = registerMutation.isPending || updateMutation.isPending || submitMutation.isPending;

  return (
    <>
      <BackHeader />

      <PageContainer withBottomNav={false}>
        <PageTitle
          title="تسجيل مقدم خدمة"
          subtitle={`الخطوة ${step} من 2 — ${STEPS[step - 1]?.label ?? ''}`}
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
            {/* بلا Client ID يخفي الزر نفسه — فنُخفي الكتلة كلها مع نصّها */}
            {GOOGLE_SIGN_IN_ENABLED && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && !hasAccount && (
              <div className="mb-4 flex flex-col gap-3">
                <GoogleSignInButton
                  intent="register"
                  label="التسجيل السريع عبر جوجل"
                  onSuccess={continueWithGoogle}
                />
                <p className="text-center text-badge leading-5 text-ink-400">
                  بلا كلمة مرور — بعدها بياناتك ومهنتك وصورة البطاقة فقط. بالمتابعة أنت توافق على{' '}
                  <Link href="/terms" className="font-semibold text-brand-600">
                    الشروط والأحكام
                  </Link>{' '}
                  و
                  <Link href="/privacy" className="font-semibold text-brand-600">
                    سياسة الخصوصية
                  </Link>
                  .
                </p>
                <p className="text-center text-badge text-ink-400">أو سجّل بالهاتف وكلمة المرور</p>
              </div>
            )}

            {!hasAccount && (
              <InfoAlert tone="info" className="mb-4">
                خطوتان فقط وتبدأ استقبال الطلبات. العنوان التفصيلي ووصف خدمتك وسنوات خبرتك تكملها
                لاحقًا من ملفك.
              </InfoAlert>
            )}

            <QuickInfoStep
              values={info}
              errors={pickErrors(errors, QUICK_INFO_KEYS)}
              onChange={updateInfo}
              whatsappSame={whatsappSame}
              onWhatsappSameChange={setWhatsappSame}
              lockPhone={hasAccount}
            />

            <div className="mt-4">
              <CredentialsFields
                values={credentials}
                errors={pickErrors(errors, CREDENTIALS_KEYS)}
                onChange={(patch) => setCredentials((current) => ({ ...current, ...patch }))}
                withPassword={!hasAccount}
              />
            </div>

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

        {step === 2 && hasAccount && !documents.isComplete && documents.missingRequired.length > 0 && (
          <p className="mt-6 text-meta font-semibold text-danger" role="status">
            لا يمكن الإرسال قبل رفع: {documents.missingRequired.join('، ')}
          </p>
        )}

        {step === 2 && (
          <Checkbox
            id="provider-pledge"
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
              loading={registerMutation.isPending || updateMutation.isPending}
              disabled={busy}
              onClick={() => void goToStep2()}
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
