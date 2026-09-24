'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type {
  AdminCategoryDto,
  AdminProfessionDto,
  AdminUserDto,
  DashboardDto,
} from '@/server/services/admin.service';
import type {
  BroadcastNotificationInput,
  CreateCategoryInput,
  CreateProfessionInput,
  SetReviewVisibilityInput,
  SetServiceActiveInput,
  SetUserStatusInput,
  UpdateCategoryInput,
  UpdateProfessionInput,
  UpsertSettingInput,
} from '@/shared/schemas/admin.schema';
import type { AdminReportDto } from '@/server/services/report.service';
import type { ResolveReportInput } from '@/shared/schemas/report.schema';

/**
 * خطافات لوحة الإدارة — Phase 10.
 * نفس اصطلاح `lib/queries/provider.ts`: قوائم الترقيم تعيد `ApiResult`
 * كاملًا (تحتاج `meta.total`)، والتفاصيل والكتابة تُعيد `.data` مباشرة.
 */

/* ================================================================== */
/* لوحة القيادة                                                        */
/* ================================================================== */

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard,
    queryFn: async () => (await api.get<DashboardDto>('/admin/dashboard')).data,
    staleTime: 30_000,
  });
}

/* ================================================================== */
/* المستخدمون                                                          */
/* ================================================================== */

export interface UsersFilter {
  [key: string]: string | number | boolean | undefined;
  role?: string;
  status?: string;
  q?: string;
  page: number;
  limit: number;
}

export function useAdminUsers(filter: UsersFilter) {
  return useQuery({
    queryKey: queryKeys.admin.users(filter),
    queryFn: async () => api.get<AdminUserDto[]>('/admin/users', { query: filter }),
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string } & SetUserStatusInput) => {
      const { userId, ...body } = input;
      return (await api.patch<AdminUserDto>(`/admin/users/${userId}/status`, body)).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    },
  });
}

/* ================================================================== */
/* التصنيفات                                                           */
/* ================================================================== */

export function useAdminCategories() {
  return useQuery({
    queryKey: queryKeys.admin.categories,
    queryFn: async () => (await api.get<AdminCategoryDto[]>('/admin/categories')).data,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) =>
      (await api.post<AdminCategoryDto>('/admin/categories', input)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { categoryId: string } & UpdateCategoryInput) => {
      const { categoryId, ...body } = input;
      return (await api.patch<AdminCategoryDto>(`/admin/categories/${categoryId}`, body)).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'professions'] });
    },
  });
}

/* ================================================================== */
/* المهن + متطلبات المستندات                                           */
/* ================================================================== */

export interface ProfessionsFilter {
  [key: string]: string | number | boolean | undefined;
  categoryId?: string;
  includeInactive?: boolean;
}

export function useAdminProfessions(filter: ProfessionsFilter = {}) {
  return useQuery({
    queryKey: queryKeys.admin.professions(filter),
    queryFn: async () =>
      (
        await api.get<AdminProfessionDto[]>('/admin/professions', {
          query: {
            categoryId: filter.categoryId,
            includeInactive: filter.includeInactive === false ? 'false' : 'true',
          },
        })
      ).data,
  });
}

export function useCreateProfession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProfessionInput) =>
      (await api.post<AdminProfessionDto>('/admin/professions', input)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'professions'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories });
    },
  });
}

export function useUpdateProfession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { professionId: string } & UpdateProfessionInput) => {
      const { professionId, ...body } = input;
      return (await api.patch<AdminProfessionDto>(`/admin/professions/${professionId}`, body))
        .data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'professions'] });
      // تغيّرت المتطلبات — قد يكون طرف تسجيل يعرض نفس البيانات الآن
      void queryClient.invalidateQueries({ queryKey: ['professions'] });
    },
  });
}

/* ================================================================== */
/* الخدمات (إشراف)                                                     */
/* ================================================================== */

export interface AdminServiceDto {
  id: string;
  providerId: string;
  title: string;
  isActive: boolean;
  ratingAvg: number;
  ratingCount: number;
  ordersCount: number;
  createdAt: string;
}

export interface ServicesFilter {
  [key: string]: string | number | boolean | undefined;
  q?: string;
  isActive?: string;
  page: number;
  limit: number;
}

export function useAdminServices(filter: ServicesFilter) {
  return useQuery({
    queryKey: queryKeys.admin.services(filter),
    queryFn: async () => api.get<AdminServiceDto[]>('/admin/services', { query: filter }),
  });
}

export function useSetServiceActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { serviceId: string } & SetServiceActiveInput) => {
      const { serviceId, ...body } = input;
      return (
        await api.patch<{ id: string; isActive: boolean }>(`/admin/services/${serviceId}`, body)
      ).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
  });
}

/* ================================================================== */
/* التقييمات (إشراف)                                                   */
/* ================================================================== */

export interface AdminReviewDto {
  id: string;
  orderId: string;
  providerId: string;
  rating: number;
  comment?: string;
  isVisible: boolean;
  adminNote?: string;
  createdAt: string;
}

export interface ReviewsFilter {
  [key: string]: string | number | boolean | undefined;
  isVisible?: string;
  page: number;
  limit: number;
}

export function useAdminReviews(filter: ReviewsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.reviews(filter),
    queryFn: async () => api.get<AdminReviewDto[]>('/admin/reviews', { query: filter }),
  });
}

export function useSetReviewVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reviewId: string } & SetReviewVisibilityInput) => {
      const { reviewId, ...body } = input;
      return (
        await api.patch<{ id: string; isVisible: boolean }>(`/admin/reviews/${reviewId}`, body)
      ).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
  });
}

/* ================================================================== */
/* الإشعارات العامة (Broadcast)                                        */
/* ================================================================== */

export function useBroadcastNotification() {
  return useMutation({
    mutationFn: async (input: BroadcastNotificationInput) =>
      (await api.post<{ recipientsCount: number }>('/admin/notifications/broadcast', input)).data,
  });
}

/* ================================================================== */
/* الإعدادات العامة                                                    */
/* ================================================================== */

export interface AdminSettingDto {
  id: string;
  key: string;
  value: unknown;
  description?: string;
  updatedAt: string;
}

export function useAdminSettings() {
  return useQuery({
    queryKey: queryKeys.admin.settings,
    queryFn: async () => (await api.get<AdminSettingDto[]>('/admin/settings')).data,
  });
}

export function useUpsertSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertSettingInput) =>
      (await api.post<{ key: string; value: unknown }>('/admin/settings', input)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings });
    },
  });
}

/* ================================================================== */
/* سجل التدقيق                                                         */
/* ================================================================== */

export interface AdminAuditLogDto {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

export interface AuditLogsFilter {
  [key: string]: string | number | boolean | undefined;
  entityType?: string;
  action?: string;
  page: number;
  limit: number;
}

export function useAdminAuditLogs(filter: AuditLogsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(filter),
    queryFn: async () => api.get<AdminAuditLogDto[]>('/admin/audit-logs', { query: filter }),
  });
}

/* ================================================================== */
/* البلاغات — سياسة Google Play للمحتوى الذي ينشئه المستخدمون          */
/* ================================================================== */

export interface ReportsFilter {
  [key: string]: string | number | boolean | undefined;
  status?: string;
  page: number;
  limit: number;
}

export function useAdminReports(filter: ReportsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.reports(filter),
    queryFn: async () => api.get<AdminReportDto[]>('/admin/reports', { query: filter }),
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reportId: string } & ResolveReportInput) => {
      const { reportId, ...body } = input;
      return (
        await api.patch<{ id: string; status: string }>(`/admin/reports/${reportId}`, body)
      ).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
  });
}
