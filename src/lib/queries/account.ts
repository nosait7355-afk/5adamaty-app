'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type {
  AccountSummaryDto,
  AddressDto,
  NotificationDto,
} from '@/server/services/account.service';
import type { AuthUserDto } from '@/server/services/auth.service';
import type { NotificationTab } from '@/shared/constants/notifications';

/* ================================================================== */
/* الإشعارات — الصورة 15                                               */
/* ================================================================== */

export interface NotificationsResponse {
  items: NotificationDto[];
  counts: Record<string, number>;
  unreadTotal: number;
}

export function useNotifications(tab: NotificationTab = 'ALL') {
  return useQuery({
    queryKey: queryKeys.notifications.list({ tab }),
    queryFn: async () =>
      (await api.get<NotificationsResponse>('/notifications', { query: { tab, limit: 50 } })).data,
  });
}

/** شارة الجرس وتبويب الرسائل — تُحدَّث بعد كل إجراء. */
export function useUnreadCounts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () =>
      (await api.get<{ notifications: number }>('/notifications/unread-count'))
        .data,
    retry: false,
    enabled,
  });
}

export function useReadNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      (await api.patch<NotificationDto>(`/notifications/${id}/read`)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useReadAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => (await api.post<{ updated: number }>('/notifications/read-all')).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/* ================================================================== */
/* الحساب والعناوين والمفضلة — الصور 16 و17                            */
/* ================================================================== */

export function useAccountSummary() {
  return useQuery({
    queryKey: queryKeys.account.summary,
    queryFn: async () => (await api.get<AccountSummaryDto>('/me/account')).data,
    retry: false,
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: queryKeys.account.addresses,
    queryFn: async () => (await api.get<AddressDto[]>('/me/addresses')).data,
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<AddressDto>('/me/addresses', input)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; patch: Record<string, unknown> }) =>
      (await api.patch<AddressDto>(`/me/addresses/${input.id}`, input.patch)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      (await api.patch<AddressDto[]>(`/me/addresses/${id}/default`)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/me/addresses/${id}`)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

export interface FavoritesResponse {
  providers: {
    id: string;
    displayName: string;
    professionName?: string;
    ratingAvg: number;
    ratingCount: number;
    area?: string;
  }[];
  services: { id: string; title: string; ratingAvg: number; providerId: string }[];
  total: number;
}

/** `enabled: false` للزائر — المسار يتطلب جلسة، فلا داعي لطلب ينتهي بـ401. */
export function useFavorites(enabled = true) {
  return useQuery({
    queryKey: queryKeys.account.favorites,
    queryFn: async () => (await api.get<FavoritesResponse>('/me/favorites')).data,
    enabled,
  });
}

type FavoriteProvider = FavoritesResponse['providers'][number];
type FavoriteService = FavoritesResponse['services'][number];

export type ToggleFavoriteInput =
  /** `preview` = بيانات العنصر لعرضه في القائمة فورًا عند الإضافة. */
  | { providerId: string; preview?: FavoriteProvider }
  | { serviceId: string; preview?: FavoriteService };

/** يقلب العنصر في نسخة الكاش — نفس منطق التبديل على الخادم. */
function toggleInCache(data: FavoritesResponse, input: ToggleFavoriteInput): FavoritesResponse {
  if ('providerId' in input) {
    const exists = data.providers.some((item) => item.id === input.providerId);
    if (exists) {
      return {
        ...data,
        providers: data.providers.filter((item) => item.id !== input.providerId),
        total: data.total - 1,
      };
    }
    return input.preview
      ? { ...data, providers: [input.preview, ...data.providers], total: data.total + 1 }
      : data;
  }

  const exists = data.services.some((item) => item.id === input.serviceId);
  if (exists) {
    return {
      ...data,
      services: data.services.filter((item) => item.id !== input.serviceId),
      total: data.total - 1,
    };
  }
  return input.preview
    ? { ...data, services: [input.preview, ...data.services], total: data.total + 1 }
    : data;
}

/**
 * إضافة/إزالة من المفضلة — **متفائل**: القلب والقائمة يتغيّران لحظة
 * الضغط، والطلب يكمل في الخلفية. إن فشل تعود الحالة كما كانت ويُرمى الخطأ
 * لمن استدعى (`mutate(…, { onError })`) ليُعلم المستخدم.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const key = queryKeys.account.favorites;

  return useMutation({
    mutationFn: async (input: ToggleFavoriteInput) => {
      // `preview` للواجهة فقط — المخطط على الخادم `.strict()` يرفض أي مفتاح زائد
      const body = 'providerId' in input ? { providerId: input.providerId } : { serviceId: input.serviceId };
      return (await api.post<{ added: boolean; total: number }>('/me/favorites', body)).data;
    },
    onMutate: async (input) => {
      // طلب جلب جارٍ قد يعود بالقائمة القديمة فيطمس التحديث المتفائل
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FavoritesResponse>(key);
      if (previous) queryClient.setQueryData(key, toggleInCache(previous, input));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.patch<AuthUserDto>('/me/profile', input)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

/* ================================================================== */
/* مركز المساعدة — الصورة 18                                           */
/* ================================================================== */

export interface FaqDto {
  id: string;
  question: string;
  answer: string;
  topic: string;
  helpfulYes: number;
  helpfulNo: number;
}

export function useFaqs(q?: string) {
  return useQuery({
    queryKey: queryKeys.faqs.list(q ?? ''),
    queryFn: async () => (await api.get<FaqDto[]>('/faqs', { query: { q } })).data,
  });
}

export function useFaqFeedback() {
  return useMutation({
    mutationFn: async (input: { id: string; helpful: boolean }) =>
      (await api.post(`/faqs/${input.id}/feedback`, { helpful: input.helpful })).data,
  });
}

export function useContactSupport() {
  return useMutation({
    mutationFn: async (input: { subject: string; message: string }) =>
      (await api.post<{ received: true }>('/support/contact', input)).data,
  });
}
