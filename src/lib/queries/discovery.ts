'use client';

import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import type { CreateReportInput } from '@/shared/schemas/report.schema';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type {
  ProviderCardDto,
  ProviderDetailDto,
  ReviewDto,
  SearchResultDto,
  ServiceCardDto,
  ServiceDetailDto,
} from '@/server/services/discovery.service';
import type { SortOption } from '@/shared/schemas/catalog.schema';

/**
 * استعلامات شاشات الاكتشاف (Phase 5).
 *
 * القوائم كلها `useInfiniteQuery` لأن الصورة 09 تعرض تمريرًا لا نهائيًا،
 * والصفحة تُحسب من `meta.hasMore` القادم من الخادم لا من طول المصفوفة.
 */

export interface DiscoveryFilterState {
  categoryId?: string | undefined;
  categorySlug?: string | undefined;
  professionId?: string | undefined;
  professionSlug?: string | undefined;
  providerId?: string | undefined;
  area?: string | undefined;
  minRating?: number | undefined;
  sort?: SortOption | undefined;
  limit?: number | undefined;
}

/** يحوّل حالة الفلاتر إلى معاملات استعلام، متجاهلًا الفارغ منها. */
function toQueryParams(filters: DiscoveryFilterState, page: number) {
  return {
    page,
    limit: filters.limit ?? 10,
    categoryId: filters.categoryId,
    categorySlug: filters.categorySlug,
    professionId: filters.professionId,
    professionSlug: filters.professionSlug,
    providerId: filters.providerId,
    area: filters.area,
    minRating: filters.minRating,
    sort: filters.sort ?? 'rating',
  };
}

/** المفتاح لا يحمل رقم الصفحة — TanStack تديره داخليًا. */
function listKey(filters: DiscoveryFilterState) {
  return JSON.parse(JSON.stringify(toQueryParams(filters, 1))) as Record<string, unknown>;
}

/* ================================================================== */
/* الخدمات — الصورة 09                                                 */
/* ================================================================== */

export function useServices(filters: DiscoveryFilterState = {}, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.services.list(listKey(filters)),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      api.get<ServiceCardDto[]>('/services', { query: toQueryParams(filters, pageParam) }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.meta?.hasMore ? allPages.length + 1 : undefined,
    enabled,
  });
}

export function useService(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.services.detail(id ?? ''),
    queryFn: async () => (await api.get<ServiceDetailDto>(`/services/${id}`)).data,
    enabled: Boolean(id),
  });
}

/* ================================================================== */
/* مقدمو الخدمات — الصور 06 و10                                        */
/* ================================================================== */

export function useProviders(filters: DiscoveryFilterState = {}, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.providers.list(listKey(filters)),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      api.get<ProviderCardDto[]>('/providers', { query: toQueryParams(filters, pageParam) }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.meta?.hasMore ? allPages.length + 1 : undefined,
    enabled,
  });
}

export function useProvider(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.providers.detail(id ?? ''),
    queryFn: async () => (await api.get<ProviderDetailDto>(`/providers/${id}`)).data,
    enabled: Boolean(id),
  });
}

export interface ProviderReviewsResponse {
  items: ReviewDto[];
  breakdown: Record<string, number>;
}

export function useProviderReviews(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.providers.reviews(id ?? ''),
    queryFn: async () => api.get<ProviderReviewsResponse>(`/providers/${id}/reviews`),
    enabled: Boolean(id) && enabled,
  });
}

/** «إبلاغ عن مقدم الخدمة» — سياسة Google Play للمحتوى الذي ينشئه المستخدمون. */
export function useReportProvider(providerId: string | undefined) {
  return useMutation({
    mutationFn: async (input: CreateReportInput) =>
      (await api.post<{ reported: true }>(`/providers/${providerId}/report`, input)).data,
  });
}

/* ================================================================== */
/* البحث الموحّد                                                       */
/* ================================================================== */

/** الحد الأدنى لطول نص البحث — مطابق لقاعدة الخادم. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * يؤخّر القيمة حتى يتوقف المستخدم عن الكتابة.
 * ضروري هنا لا تحسينًا: بحث الخادم محدود بـ30 طلبًا/دقيقة.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function useSearch(term: string, type: 'all' | 'services' | 'providers' = 'all') {
  const debounced = useDebouncedValue(term.trim());
  const enabled = debounced.length >= MIN_SEARCH_LENGTH;

  const query = useQuery({
    queryKey: queryKeys.search.query(debounced, type),
    queryFn: async () =>
      (await api.get<SearchResultDto>('/search', { query: { q: debounced, type, limit: 20 } })).data,
    enabled,
    staleTime: 60_000,
  });

  return { ...query, term: debounced, enabled };
}
