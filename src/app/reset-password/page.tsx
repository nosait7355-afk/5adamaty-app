'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Lock } from 'lucide-react';
import { AuthShell } from '@/components/features/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InfoAlert } from '@/components/common/info-alert';
import { Spinner } from '@/components/ui/spinner';
import { resetPasswordSchema, type ResetPasswordInput } from '@/shared/schemas/auth.schema';
import { extractErrorMessage, useResetPassword } from '@/lib/queries/auth';

/**
 * إعادة تعيين كلمة المرور — شاشة مشتقّة يصلها المستخدم من رابط البريد.
 *
 * تغيير كلمة المرور يُبطل كل الجلسات على كل الأجهزة، فيُطلب منه الدخول
 * من جديد بعد النجاح.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const mutation = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch {
      // يُعرض أسفل النموذج
    }
  });

  if (!token) {
    return (
      <AuthShell title="رابط غير صالح" onBack={() => router.push('/login')}>
        <InfoAlert tone="danger" title="الرابط غير مكتمل">
          افتح الرابط من رسالة البريد كما هو، أو اطلب رابطًا جديدًا.
        </InfoAlert>
        <Button fullWidth onClick={() => router.push('/forgot-password')}>
          طلب رابط جديد
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="كلمة مرور جديدة"
      subtitle="اختر كلمة مرور قوية لحسابك"
      onBack={() => router.push('/login')}
      footer={
        <p className="text-center text-label text-ink-600">
          <Link href="/login" className="font-bold text-brand-600">
            العودة لتسجيل الدخول
          </Link>
        </p>
      }
    >
      {mutation.isSuccess ? (
        <div className="flex flex-col gap-4">
          <InfoAlert tone="success" title="تم تغيير كلمة المرور">
            {mutation.data}
            <br />
            تم إنهاء جلساتك على كل الأجهزة لحماية حسابك.
          </InfoAlert>
          <Button fullWidth onClick={() => router.replace('/login')}>
            تسجيل الدخول
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <input type="hidden" {...register('token')} />

          <Field
            label="كلمة المرور الجديدة"
            required
            htmlFor="password"
            hint="8 أحرف على الأقل، وتحتوي حرفًا ورقمًا"
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              togglePassword
              autoComplete="new-password"
              placeholder="أدخل كلمة المرور الجديدة"
              icon={<Lock size={20} />}
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>

          <Field
            label="تأكيد كلمة المرور"
            required
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              togglePassword
              autoComplete="new-password"
              placeholder="أعد إدخال كلمة المرور"
              icon={<Lock size={20} />}
              invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </Field>

          {mutation.isError && (
            <InfoAlert tone="danger">{extractErrorMessage(mutation.error)}</InfoAlert>
          )}

          <Button
            type="submit"
            fullWidth
            loading={isSubmitting || mutation.isPending}
            iconStart={<KeyRound size={20} />}
          >
            تغيير كلمة المرور
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

function ResetPasswordFallback() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Spinner size={32} className="text-brand-600" />
    </main>
  );
}
