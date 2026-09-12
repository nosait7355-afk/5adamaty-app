'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, Lock, Mail, Smartphone, UserPlus } from 'lucide-react';
import { AuthShell } from '@/components/features/auth/auth-shell';
import { GoogleSignInButton } from '@/components/features/auth/google-sign-in-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InfoAlert } from '@/components/common/info-alert';
import { cn } from '@/lib/cn';
import {
  loginSchema,
  type LoginFormValues,
  type LoginInput,
} from '@/shared/schemas/auth.schema';
import {
  extractErrorMessage,
  resolveHomeRoute,
  useLogin,
} from '@/lib/queries/auth';
import { GOOGLE_SIGN_IN_ENABLED } from '@/shared/constants/feature-flags';

type IdentifierMode = 'phone' | 'email';

/**
 * تسجيل الدخول — الصورة 03 (المعتمدة) مع تبويبَي الهاتف/البريد ومفتاح
 * الدولة +20 المأخوذَين من الصورة 04.
 *
 * زر «الدخول عبر جوجل» هو المسار الظاهر افتراضيًا. نموذج الهاتف/البريد +
 * كلمة المرور الأصلي لا يزال يعمل بالكامل في الـbackend، لكنه مطويّ خلف
 * رابط ثانوي بقرار من صاحب المنتج (إخفاء من الواجهة فقط، لا حذف).
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<IdentifierMode>('phone');
  const [showPhoneForm, setShowPhoneForm] = useState(!GOOGLE_SIGN_IN_ENABLED);
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', remember: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await loginMutation.mutateAsync(values);
      router.replace(resolveHomeRoute(user));
    } catch {
      // الخطأ يُعرض من حالة الـmutation أسفل النموذج
    }
  });

  const switchMode = (next: IdentifierMode) => {
    setMode(next);
    setValue('identifier', '');
  };

  return (
    <AuthShell
      title="تسجيل الدخول"
      subtitle="مرحباً بك! يرجى تسجيل الدخول للمتابعة"
      onBack={() => router.push('/role-select')}
      footer={
        <div className="flex items-center justify-center gap-2 rounded-card bg-brand-50/70 px-4 py-4">
          <UserPlus size={20} className="text-brand-600" aria-hidden="true" />
          <span className="text-label text-ink-600">ليس لديك حساب؟</span>
          <Link href="/register" className="text-label font-bold text-brand-600">
            إنشاء حساب جديد
          </Link>
        </div>
      }
    >
      {GOOGLE_SIGN_IN_ENABLED && (
        <div className="flex flex-col gap-5">
          <GoogleSignInButton onSuccess={(user) => router.replace(resolveHomeRoute(user))} />

          {!showPhoneForm && (
            <button
              type="button"
              onClick={() => setShowPhoneForm(true)}
              className="text-center text-label font-semibold text-brand-600"
            >
              تسجيل الدخول برقم الهاتف أو البريد بدلًا من ذلك
            </button>
          )}
        </div>
      )}

      {showPhoneForm && (
      <form onSubmit={onSubmit} noValidate className={GOOGLE_SIGN_IN_ENABLED ? 'mt-5 flex flex-col gap-5 border-t border-border pt-5' : 'flex flex-col gap-5'}>
        {/* تبويبا الهاتف/البريد — من الصورة 04 */}
        <div className="flex border-b border-border" role="tablist">
          <TabButton
            active={mode === 'phone'}
            onClick={() => switchMode('phone')}
            icon={<Smartphone size={18} />}
            label="رقم الهاتف"
          />
          <TabButton
            active={mode === 'email'}
            onClick={() => switchMode('email')}
            icon={<Mail size={18} />}
            label="البريد الإلكتروني"
          />
        </div>

        <Field
          label={mode === 'phone' ? 'رقم الهاتف' : 'البريد الإلكتروني'}
          htmlFor="identifier"
          error={errors.identifier?.message}
        >
          <Input
            id="identifier"
            inputMode={mode === 'phone' ? 'tel' : 'email'}
            autoComplete={mode === 'phone' ? 'tel' : 'email'}
            /*
             * `dir="ltr"` على الهاتف والبريد معًا.
             * بدونه يقلب محرك BiDi مجموعات الأرقام فيُعرض «010 1234 5678»
             * كـ«5678 1234 010». `text-end` يُبقي المحاذاة يمينًا كما في التصميم.
             */
            dir="ltr"
            className="[&_input]:text-end"
            placeholder={mode === 'phone' ? '010 1234 5678' : 'example@email.com'}
            icon={mode === 'phone' ? <Smartphone size={20} /> : <Mail size={20} />}
            invalid={Boolean(errors.identifier)}
            /*
             * مفتاح الدولة الثابت +20 — من الصورة 04.
             * بلا إيموجي علم: ويندوز لا يرسم رموز العلم فتظهر كحرفَي «EG».
             */
            action={
              mode === 'phone' ? (
                <span className="num border-s border-border ps-3 text-label font-semibold text-ink-600">
                  +20
                </span>
              ) : undefined
            }
            {...register('identifier')}
          />
        </Field>

        <Field label="كلمة المرور" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            togglePassword
            autoComplete="current-password"
            placeholder="أدخل كلمة المرور"
            icon={<Lock size={20} />}
            invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <div className="flex items-center justify-between gap-3">
          <Checkbox id="remember" label="تذكرني" {...register('remember')} />
          <Link href="/forgot-password" className="text-label font-semibold text-brand-600">
            نسيت كلمة المرور؟
          </Link>
        </div>

        {loginMutation.isError && (
          <InfoAlert tone="danger">{extractErrorMessage(loginMutation.error)}</InfoAlert>
        )}

        <Button
          type="submit"
          fullWidth
          loading={isSubmitting || loginMutation.isPending}
          iconStart={<LogIn size={20} />}
        >
          تسجيل الدخول
        </Button>
      </form>
      )}
    </AuthShell>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 border-b-2 pb-3 text-label transition-colors',
        active
          ? 'border-brand-600 font-bold text-brand-600'
          : 'border-transparent text-ink-400 hover:text-ink-600'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
