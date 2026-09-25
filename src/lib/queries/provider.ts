'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type {
  AdminProviderListItemDto,
  ProviderProfileDto,
} from '@/server/services/provider.service';
import type { ProviderDashboardDto } from '@/server/services/provider-dashboard.service';
import type {
  ConvertToProviderValues,
  ProviderStep1Values,
  ProviderStep2Values,
  VerificationDecisionInput,
} from '@/shared/schemas/provider.schema';
import type { VerificationStatus } from '@/shared/constants/roles';

export interface MyDocumentDto {
  id: string;
  requirementKey: string;
  customKey?: string;
  status: string;
  rejectionReason?: string;
  format: string;
  bytes: number;
}

/**
 * مستندات المزوّد المرفوعة فعلًا على الخادم — تجعل بطاقات الرفع تبدأ بحالتها
 * الحقيقية بدل أن تظهر فارغة عند العودة لخطوة المستندات.
 */
export function useMyDocuments(enabled = true) {
  return useQuery({
    queryKey: ['provider', 'documents'] as const,
    queryFn: async () =>
      (
        await api.get<{ documents: MyDocumentDto[]; missingRequired: string[]; isComplete: boolean }>(
          '/provider/documents'
        )
      ).data,
    enabled,
    retry: false,
  });
}

/** لوحة تحكم مقدم الخدمة — الصورة 24. */
export function useProviderDashboard() {
  return useQuery({
    queryKey: queryKeys.provider.dashboard,
    queryFn: async () => (await api.get<ProviderDashboardDto>('/provider/dashboard')).data,
    retry: false,
  });
}

/** ملف مقدم الخدمة الحالي — يغذّي شاشتي المراجعة (22) وقيد المراجعة (23). */
export function useMyProviderProfile(enabled = true) {
  return useQuery({
    queryKey: queryKeys.provider.profile,
    queryFn: async () => (await api.get<ProviderProfileDto>('/provider/profile')).data,
    enabled,
    retry: false,
  });
}

export interface RegisterProviderPayload {
  step1: ProviderStep1Values;
  step2: ProviderStep2Values;
}

/** إنشاء الحساب بعد الخطوة 2/4 — يفتح جلسة تتيح رفع المستندات. */
export function useRegisterProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterProviderPayload) =>
      (
        await api.post<{ user: { id: string }; providerId: string }>(
          '/auth/register-provider',
          payload
        )
      ).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.me });
    },
  });
}

/** تعديل بيانات الملف من أزرار «تعديل» في شاشة المراجعة. */
export function useUpdateProviderProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) =>
      (await api.patch<ProviderProfileDto>('/provider/profile', patch)).data,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.provider.profile, profile);
    },
  });
}

/**
 * تحويل حساب عميل إلى مقدم خدمة — ينشئ ملف مزوّد بحالة مسودة.
 *
 * لا يغيّر الدور: ذلك يحدث عند إرسال الطلب (`useSubmitVerification`).
 */
export function useBecomeProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConvertToProviderValues) =>
      (await api.post<ProviderProfileDto>('/me/become-provider', input)).data,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.provider.profile, profile);
    },
  });
}

/** إرسال طلب التسجيل — الخطوة 4/4. */
export function useSubmitVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      (await api.post<ProviderProfileDto>('/provider/verification/submit', { acceptTerms: true }))
        .data,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.provider.profile, profile);
    },
  });
}

/* ================================================================== */
/* سابقة الأعمال                                                       */
/* ================================================================== */

/** يضيف صورة أو فيديو مرفوعًا إلى «سابقة أعمالي». */
export function useAddPortfolioItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { publicId: string; kind: 'IMAGE' | 'VIDEO' }) =>
      (await api.post<ProviderProfileDto>('/provider/portfolio', input)).data,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.provider.profile, profile);
    },
  });
}

/** يحذف عنصرًا من «سابقة أعمالي» — من القاعدة ومن Cloudinary معًا. */
export function useRemovePortfolioItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (publicId: string) =>
      (await api.delete<ProviderProfileDto>('/provider/portfolio', { body: { publicId } })).data,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.provider.profile, profile);
    },
  });
}

/* ================================================================== */
/* الإدارة                                                             */
/* ================================================================== */

export function useVerificationQueue(status: VerificationStatus = 'PENDING_REVIEW') {
  return useQuery({
    queryKey: queryKeys.admin.verificationQueue(status),
    queryFn: async () =>
      api.get<AdminProviderListItemDto[]>('/admin/providers', { query: { status, limit: 50 } }),
  });
}

export interface AdminProviderDetail {
  id: string;
  displayName: string;
  professionName: string;
  bio: string;
  coverageAreas: string[];
  yearsOfExperience?: number;
  profileCompletion: number;
  verification: {
    status: VerificationStatus;
    statusLabel: string;
    requestNumber: string;
    submittedAt?: string;
    rejectionReason?: string;
  };
  contact: { fullName: string; phone?: string; email?: string; city?: string; addressLine?: string };
  documents: {
    id: string;
    requirementKey: string;
    label: string;
    status: string;
    format: string;
    bytes: number;
    uploadedAt: string;
  }[];
  documentsState: { isComplete: boolean; missingRequired: string[] };
}

export function useAdminProvider(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.provider(id ?? ''),
    queryFn: async () => (await api.get<AdminProviderDetail>(`/admin/providers/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useDecideVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { providerId: string } & VerificationDecisionInput) => {
      const { providerId, ...decision } = input;
      return (
        await api.patch<{ id: string; status: VerificationStatus }>(
          `/admin/providers/${providerId}/verification`,
          decision
        )
      ).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

/**
 * رابط عرض موقّت لمستند.
 *
 * لا يُخزَّن ولا يُحفظ في الـcache: يُطلب عند فتح المستند فقط وينتهي خلال
 * دقائق (ARCHITECTURE §8).
 */
export async function fetchDocumentUrl(documentId: string): Promise<string> {
  const { data } = await api.get<{ url: string }>(`/provider/documents/${documentId}/url`);
  return data.url;
}
