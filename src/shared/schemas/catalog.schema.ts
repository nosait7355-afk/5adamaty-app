import { z } from 'zod';
import { objectIdSchema, paginationSchema, safeString, slugSchema } from './common.schema';
import { ALL_FAYOUM_AREAS } from '@/shared/constants/fayoum-areas';

/** معاملات قائمة التصنيفات. */
export const listCategoriesQuerySchema = z
  .object({
    includeInactive: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .strict();

export const categorySlugParamSchema = z.object({ slug: slugSchema }).strict();

/** معاملات قائمة المهن. */
export const listProfessionsQuerySchema = z
  .object({
    categoryId: objectIdSchema.optional(),
    categorySlug: slugSchema.optional(),
  })
  .strict();

export const professionIdParamSchema = z.object({ id: objectIdSchema }).strict();

/**
 * ترتيب نتائج البحث — الخيارات الظاهرة في شريط الفلاتر (الصورة 09).
 *
 * خيارا السعر (`price_asc`/`price_desc`) أُزيلا مع إزالة التسعير من
 * المنصة: لم يعد هناك حقل سعر يُرتَّب عليه.
 */
export const SORT_OPTIONS = ['rating', 'newest'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS_AR: Record<SortOption, string> = {
  rating: 'الأعلى تقييمًا',
  newest: 'الأحدث',
};

/**
 * فلاتر اكتشاف مقدمي الخدمات والخدمات (Phase 5).
 * `area` نص من قائمة الفيوم الثابتة — لا إحداثيات ولا نصف قطر بحث.
 */
export const discoveryQuerySchema = paginationSchema
  .extend({
    q: safeString(100).optional(),
    categoryId: objectIdSchema.optional(),
    categorySlug: slugSchema.optional(),
    professionId: objectIdSchema.optional(),
    professionSlug: slugSchema.optional(),
    providerId: objectIdSchema.optional(),
    area: z
      .string()
      .trim()
      .refine((value) => ALL_FAYOUM_AREAS.includes(value), { message: 'المنطقة غير صالحة.' })
      .optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    sort: z.enum(SORT_OPTIONS).default('rating'),
  })
  .strict();

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;

/* ---- معاملات التفاصيل والبحث الموحّد (Phase 5) ---- */

export const providerIdParamSchema = z.object({ id: objectIdSchema }).strict();
export const serviceIdParamSchema = z.object({ id: objectIdSchema }).strict();

/** تقييمات مزوّد — ترقيم فقط؛ التقييمات المخفية إداريًا لا تُعاد إطلاقًا. */
export const reviewsQuerySchema = paginationSchema.strict();

/** أنواع نتائج البحث الموحّد — الشاشة المشتقّة من حقل البحث في 06–09. */
export const SEARCH_TYPES = ['all', 'services', 'providers'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/**
 * البحث الموحّد.
 * الحد الأدنى حرفان — يمنع مسح الفهرس النصي كاملًا بحرف واحد.
 */
export const searchQuerySchema = paginationSchema
  .extend({
    q: safeString(100).refine((value) => value.length >= 2, {
      message: 'اكتب حرفين على الأقل للبحث.',
    }),
    type: z.enum(SEARCH_TYPES).default('all'),
  })
  .strict();

export type SearchQuery = z.infer<typeof searchQuerySchema>;
