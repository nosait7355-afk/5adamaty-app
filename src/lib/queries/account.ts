'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type {
  AccountSummaryDto,
  AddressDto,
  NotificationDto,
  ReviewResultDto,
} from '@/server/services/account.service';
import type { MessageDto, ThreadDto } from '@/server/services/messaging.service';
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
export function useUnreadCounts() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () =>
      (await api.get<{ notifications: number; messages: number }>('/notifications/unread-count'))
        .data,
    retry: false,
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
/* التقييمات                                                           */
/* ================================================================== */

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { orderId: string; rating: number; comment?: string }) => {
      const { orderId, ...body } = input;
      return (await api.post<ReviewResultDto>(`/orders/${orderId}/review`, body)).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });
}

/* ================================================================== */
/* الحساب والعناوين والمفضلة — الصور 16 و17                            */
/* ================================================================== */

export function useAccountSummary() {
  return useQuery({
    queryKey: queryKeys.account.me,
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

export function useFavorites() {
  return useQuery({
    queryKey: queryKeys.account.favorites,
    queryFn: async () => (await api.get<FavoritesResponse>('/me/favorites')).data,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { providerId?: string; serviceId?: string }) =>
      (await api.post<{ added: boolean; total: number }>('/me/favorites', input)).data,
    onSuccess: () => {
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

/* ================================================================== */
/* المراسلة                                                            */
/* ================================================================== */

export function useThreads() {
  return useQuery({
    queryKey: queryKeys.threads.list,
    queryFn: async () =>
      (await api.get<{ items: ThreadDto[]; unreadTotal: number }>('/threads', { query: { limit: 50 } }))
        .data,
  });
}

/**
 * رسائل المحادثة.
 *
 * `refetchInterval` استقصاء دوري بدل SSE: يكفي لمحادثة تشغيلية قصيرة حول
 * طلب، ويتجنّب تعقيد اتصال دائم على استضافة serverless.
 */
export function useThreadMessages(threadId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.threads.messages(threadId ?? ''),
    queryFn: async () =>
      (
        await api.get<{ thread: ThreadDto; items: MessageDto[] }>(
          `/threads/${threadId}/messages`,
          { query: { limit: 50 } }
        )
      ).data,
    enabled: Boolean(threadId),
    refetchInterval: 15_000,
  });
}

export function useOpenOrderThread() {
  return useMutation({
    mutationFn: async (orderId: string) =>
      (await api.post<ThreadDto>(`/orders/${orderId}/thread`)).data,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { threadId: string; body: string }) =>
      (await api.post<MessageDto>(`/threads/${input.threadId}/messages`, { body: input.body })).data,
    onSuccess: (_message, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.threads.messages(variables.threadId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads.list });
    },
  });
}
