'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, Lock, Mail, UserPlus } from 'lucide-react';
import { AuthShell } from '@/components/features/auth/auth-shell';
import { GoogleSignInButton } from '@/components/features/auth/google-sign-in-button';
import { Button, LinkButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InfoAlert } from '@/components/common/info-alert';
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

/**
 * تسجيل الدخول — الصورة 03 مع تعديل لاحق بقرار صاحب المنتج: لا تبويب هاتف
 * (كان في الصورة 04) — البريد هو الحقل الوحيد الظاهر، وزر «الدخول عبر
 * جوجل» ثم «إنشاء حساب جديد» تحت زر الدخول مباشرة — ثلاثة أزرار متتالية
 * بمسافة صغيرة وبلا فاصل «أو».
 *
 * `identifier` في `loginSchema` لا يزال يقبل هاتفًا أيضًا (خلفيًا فقط —
 * لأي حساب قديم سُجّل برقم هاتف)، لكن لا واجهة له بعد الآن.
 */
export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', remember: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await loginMutation.mutateAsync(values);
      router.replace(resolveHomeRoute(user));
    } catch {
      // الخطأ يُعرض من حالة الـmutation أسفل النموذج
    }
  });

  return (
    <AuthShell
      title="تسجيل الدخول"
      subtitle="مرحباً بك! يرجى تسجيل الدخول للمتابعة"
      onBack={() => router.push('/role-select')}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field label="البريد الإلكتروني" htmlFor="identifier" error={errors.identifier?.message}>
          <Input
            id="identifier"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            className="[&_input]:text-end"
            placeholder="example@email.com"
            icon={<Mail size={20} />}
            invalid={Boolean(errors.identifier)}
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

        {/* الأزرار الثلاثة متتالية بمسافة صغيرة: دخول · جوجل · حساب جديد */}
        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            fullWidth
            loading={isSubmitting || loginMutation.isPending}
            iconStart={<LogIn size={20} />}
          >
            تسجيل الدخول
          </Button>

          {GOOGLE_SIGN_IN_ENABLED && (
            <GoogleSignInButton
              intent="login"
              onSuccess={(user) => router.replace(resolveHomeRoute(user))}
            />
          )}

          <LinkButton
            href="/register"
            variant="secondary"
            fullWidth
            iconStart={<UserPlus size={20} />}
          >
            إنشاء حساب جديد
          </LinkButton>
        </div>
      </form>
    </AuthShell>
  );
}
