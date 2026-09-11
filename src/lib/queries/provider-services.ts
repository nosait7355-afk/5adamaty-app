'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { ServiceDto } from '@/server/services/provider-services.service';
import type {
  CreateProviderServiceInput,
  UpdateProviderServiceInput,
} from '@/shared/schemas/provider.schema';

export function useMyServices() {
  return useQuery({
    queryKey: queryKeys.provider.services,
    queryFn: async () => (await api.get<ServiceDto[]>('/provider/services', { query: { limit: 50 } })).data,
  });
}

export function useCreateMyService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProviderServiceInput) =>
      (await api.post<ServiceDto>('/provider/services', input)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.provider.services });
    },
  });
}

export function useUpdateMyService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateProviderServiceInput }) =>
      (await api.patch<ServiceDto>(`/provider/services/${id}`, patch)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.provider.services });
    },
  });
}

export function useDeleteMyService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => (await api.delete<{ id: string }>(`/provider/services/${id}`)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.provider.services });
    },
  });
}
