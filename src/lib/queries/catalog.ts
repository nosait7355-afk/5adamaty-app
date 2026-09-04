'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type {
  CategoryDto,
  DocumentRequirementDto,
  ProfessionDto,
} from '@/server/services/catalog.service';

/** التصنيفات الرئيسية — الصورة 08. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async () => (await api.get<CategoryDto[]>('/categories')).data,
    // الكتالوج نادر التغيّر — نطيل صلاحيته لتقليل الطلبات
    staleTime: 10 * 60_000,
  });
}

/** المهن داخل تصنيف — الصورة 07، و«التخصص الدقيق» في الصورة 20. */
export function useProfessions(categoryId?: string) {
  return useQuery({
    queryKey: queryKeys.professions.byCategory(categoryId ?? 'all'),
    queryFn: async () =>
      (
        await api.get<ProfessionDto[]>('/professions', {
          query: { categoryId },
        })
      ).data,
    staleTime: 10 * 60_000,
  });
}

export interface DocumentRequirementsResponse {
  professionId: string;
  professionName: string;
  requiresQualification: boolean;
  requiresLicense: boolean;
  requirements: DocumentRequirementDto[];
}

/**
 * متطلبات المستندات لمهنة — المصدر الوحيد الذي تُبنى منه شاشة المستندات (3/4).
 *
 * الواجهة لا تحمل أي قائمة ثابتة: عدد البطاقات وتسمياتها وترتيبها وحالة
 * الإلزام كلها تأتي من هنا، ويحرّرها Admin بلا نشر كود.
 */
export function useDocumentRequirements(professionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.professions.documentRequirements(professionId ?? ''),
    queryFn: async () =>
      (
        await api.get<DocumentRequirementsResponse>(
          `/professions/${professionId}/document-requirements`
        )
      ).data,
    enabled: Boolean(professionId),
    staleTime: 10 * 60_000,
  });
}
