import { z } from 'zod';
import { objectIdSchema } from './common.schema';
import { publicIdSchema } from './upload.schema';
import { BANNER_ARTS, BANNER_HREF_PATTERN, BANNER_TONES } from '@/shared/constants/banners';

/**
 * بانرات الرئيسية — مخططات لوحة الإدارة.
 *
 * `.strict()` كالمعتاد: أي مفتاح غير معرّف يُرفض.
 */

const bannerFields = {
  title: z.string().trim().min(3, 'العنوان قصير جدًا.').max(60, 'العنوان أطول من 60 حرفًا.'),
  description: z.string().trim().max(160, 'الوصف أطول من 160 حرفًا.').default(''),
  ctaLabel: z.string().trim().min(2, 'نص الزر قصير جدًا.').max(24, 'نص الزر أطول من 24 حرفًا.'),
  href: z
    .string()
    .trim()
    .max(200)
    .regex(BANNER_HREF_PATTERN, 'الرابط يجب أن يكون صفحة داخل التطبيق ويبدأ بـ / (مثل /categories).'),
  tone: z.enum(BANNER_TONES).default('brand'),
  /** رسمة مضمّنة، أو `null` لبانر بلا رسمة. */
  art: z.enum(BANNER_ARTS).nullable().default(null),
  order: z.number().int().min(0).max(100).default(0),
};

export const createBannerSchema = z.object(bannerFields).strict();
export type CreateBannerInput = z.infer<typeof createBannerSchema>;

export const updateBannerSchema = z
  .object({
    title: bannerFields.title.optional(),
    description: z.string().trim().max(160, 'الوصف أطول من 160 حرفًا.').optional(),
    ctaLabel: bannerFields.ctaLabel.optional(),
    href: bannerFields.href.optional(),
    tone: z.enum(BANNER_TONES).optional(),
    art: z.enum(BANNER_ARTS).nullable().optional(),
    order: z.number().int().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    /**
     * صورة البانر بعد رفعها إلى Cloudinary (غرض `BANNER_IMAGE`). `null` يزيلها
     * فتعود الرسمة المختارة. الخادم يتحقق منها عند Cloudinary نفسها.
     */
    imagePublicId: publicIdSchema.nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'لا يوجد ما يُحدَّث.' });
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;

export const bannerIdParamSchema = z.object({ id: objectIdSchema }).strict();
