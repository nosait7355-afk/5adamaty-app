'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type {
  ProviderDashboardDto,
  ProviderOrderDto,
} from '@/server/services/provider-orders.service';
import type {
  ProviderOrderSort,
  ProviderOrderTab,
  ProviderStatusAction,
} from '@/shared/schemas/order.schema';

export interface ProviderOrdersResponse {
  items: ProviderOrderDto[];
  counts: Record<string, number>;
}

/** لوحة تحكم مقدم الخدمة — الصورة 24. */
export function useProviderDashboard() {
  return useQuery({
    queryKey: queryKeys.provider.dashboard,
    queryFn: async () => (await api.get<ProviderDashboardDto>('/provider/dashboard')).data,
    retry: false,
  });
}

/** «طلباتي» لمقدم الخدمة — الصورة 25. */
export function useProviderOrders(options: {
  tab?: ProviderOrderTab;
  q?: string;
  sort?: ProviderOrderSort;
}) {
  const { tab = 'ALL', q, sort = 'newest' } = options;

  return useQuery({
    queryKey: queryKeys.provider.orders(tab, q ?? '', sort),
    queryFn: async () =>
      api.get<ProviderOrdersResponse>('/provider/orders', {
        query: { tab, sort, limit: 50, ...(q ? { q } : {}) },
      }),
  });
}

/**
 * تفاصيل الطلب من جانب المزوّد.
 *
 * مسار `/provider/orders/:id` لا `/orders/:id`: الأخير يعيد شكل العميل
 * (بيانات المزوّد بلا بيانات العميل)، وهذا يعيد بيانات العميل والإجراءات
 * المتاحة التي تبني عليها الشاشة أزرارها.
 */
export function useProviderOrder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.provider.order(id ?? ''),
    queryFn: async () => (await api.get<ProviderOrderDto>(`/provider/orders/${id}`)).data,
    enabled: Boolean(id),
  });
}

/** قبول / رفض / بدء التنفيذ / في الطريق — الصورتان 26 و27. */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orderId: string;
      status: ProviderStatusAction;
      note?: string;
    }) => {
      const { orderId, ...body } = input;
      return (await api.patch<ProviderOrderDto>(`/orders/${orderId}/status`, body)).data;
    },
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.provider.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: ['provider'] });
    },
  });
}

/**
 * إكمال الطلب — الصورتان 28 و29.
 * الحقلان يُرسلان دائمًا بقيمة `true`؛ الواجهة لا تسمح بالضغط قبل التأشير،
 * والخادم يرفض أي شيء غير ذلك.
 */
export function useCompleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { orderId: string; note?: string; agreedPrice?: number }) =>
      (
        await api.post<ProviderOrderDto>(`/orders/${input.orderId}/complete`, {
          serviceCompleted: true,
          cashReceivedConfirmed: true,
          ...(input.note ? { note: input.note } : {}),
          ...(input.agreedPrice != null ? { agreedPrice: input.agreedPrice } : {}),
        })
      ).data,
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.provider.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: ['provider'] });
    },
  });
}
