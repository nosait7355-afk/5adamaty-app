'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { AuthUserDto } from '@/server/services/auth.service';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterCustomerInput,
  ResetPasswordInput,
} from '@/shared/schemas/auth.schema';

/** المستخدم الحالي. `null` يعني لا توجد جلسة — ليس خطأ. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.account.me,
    queryFn: async () => {
      try {
        const { data } = await api.get<{ user: AuthUserDto }>('/auth/me');
        return data.user;
      } catch (error) {
        // 401 حالة طبيعية لزائر غير مسجّل
        if (error instanceof ApiClientError && error.httpStatus === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post<{ user: AuthUserDto }>('/auth/login', input);
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.account.me, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterCustomerInput) => {
      const { data } = await api.post<{ user: AuthUserDto }>('/auth/register', input);
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.account.me, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (options?: { allDevices?: boolean }) => {
      await api.post(`/auth/logout${options?.allDevices ? '?all=true' : ''}`);
    },
    onSettled: () => {
      // نمسح الـcache بالكامل حتى لا تبقى بيانات المستخدم السابق ظاهرة
      queryClient.clear();
      router.replace('/role-select');
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      const { data } = await api.post<{ message: string }>('/auth/forgot-password', input);
      return data.message;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const { data } = await api.post<{ message: string }>('/auth/reset-password', input);
      return data.message;
    },
  });
}

/**
 * الوجهة بعد تسجيل الدخول حسب الدور والحالة.
 * تُستخدم في Splash وبعد الدخول والتسجيل.
 */
export function resolveHomeRoute(user: AuthUserDto | null): string {
  if (!user) return '/role-select';

  switch (user.role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'PROVIDER':
      // المزوّد غير المعتمد يُوجَّه لشاشة «قيد المراجعة» (الصورة 23)
      return user.status === 'ACTIVE' ? '/provider/dashboard' : '/provider/pending-review';
    default:
      return '/home';
  }
}

/** يحوّل أخطاء الحقول من الـAPI إلى صيغة react-hook-form. */
export function extractFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof ApiClientError && error.fields) return error.fields;
  return {};
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'حدث خطأ غير متوقع. برجاء المحاولة مرة أخرى.';
}
