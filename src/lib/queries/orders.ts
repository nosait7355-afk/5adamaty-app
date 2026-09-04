'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { OrderDto } from '@/server/services/order.service';
import type { CreateOrderInput, OrderTab } from '@/shared/schemas/order.schema';

export interface OrdersListResponse {
  items: OrderDto[];
  counts: Record<string, number>;
}

/** «طلباتي» — الصورة 13. */
export function useMyOrders(tab: OrderTab = 'ALL') {
  return useQuery({
    queryKey: queryKeys.orders.list({ tab }),
    queryFn: async () => api.get<OrdersListResponse>('/orders', { query: { tab, limit: 50 } }),
  });
}

/** تفاصيل الطلب — الصورة 14. */
export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id ?? ''),
    queryFn: async () => (await api.get<OrderDto>(`/orders/${id}`)).data,
    enabled: Boolean(id),
  });
}

/** إنشاء الطلب — الصورة 11. */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<CreateOrderInput>) =>
      (await api.post<OrderDto>('/orders', input)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/** إلغاء الطلب — الزر الأحمر في الصورة 14. */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) =>
      (await api.post<OrderDto>(`/orders/${orderId}/cancel`, reason ? { reason } : {})).data,
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.orders.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/**
 * روابط التواصل المباشر — الصورة 14.
 *
 * `tel:` و`https://wa.me/` روابط نظام لا تكاملات: لا مفتاح API ولا خدمة
 * وسيطة ولا تتبّع. يفتحها هاتف المستخدم بتطبيقه المثبّت.
 */
export function buildContactLinks(phone: string | undefined) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');
  return {
    call: `tel:${phone}`,
    whatsapp: `https://wa.me/${digits}`,
  };
}
