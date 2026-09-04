import { z } from 'zod';
import { objectIdSchema } from './common.schema';
import { DOCUMENT_KEYS } from '@/shared/constants/documents';
import {
  BYTES_PER_MB,
  MAGIC_HEADER_BYTES,
  UPLOAD_PURPOSES,
} from '@/shared/constants/uploads';

/** طلب توقيع رفع. */
export const uploadSignatureSchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSES),
    contentType: z.string().min(3).max(100),
    // حد أعلى مطلق 10MB قبل حتى النظر في قواعد الغرض — يمنع طلبات عبثية
    sizeBytes: z.number().int().positive().max(10 * BYTES_PER_MB),
    /**
     * أول بايتات الملف بـbase64 للتعرّف على نوعه الحقيقي.
     * 16 بايت تُنتج ~24 حرف base64؛ نسمح بهامش بسيط ونرفض ما زاد.
     */
    headerBase64: z
      .string()
      .min(4)
      .max(Math.ceil((MAGIC_HEADER_BYTES * 4) / 3) + 8)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'ترويسة الملف غير صالحة.'),
  })
  .strict();

export type UploadSignatureInput = z.infer<typeof uploadSignatureSchema>;

/**
 * معرّف Cloudinary العام.
 * مقيّد بمحارف المسار الآمنة — يمنع محاولات الخروج من المجلد (`../`).
 */
export const publicIdSchema = z
  .string()
  .min(3)
  .max(300)
  .regex(/^[A-Za-z0-9_\-/]+$/, 'معرّف الملف غير صالح.')
  .refine((value) => !value.includes('..'), { message: 'معرّف الملف غير صالح.' });

/** حفظ metadata مستند بعد الرفع. */
export const saveDocumentSchema = z
  .object({
    requirementKey: z.enum(DOCUMENT_KEYS),
    customKey: z.string().trim().min(1).max(40).optional(),
    publicId: publicIdSchema,
  })
  .strict()
  .refine((data) => data.requirementKey !== 'CUSTOM' || Boolean(data.customKey), {
    message: 'المستند المخصّص يحتاج مفتاحًا مميزًا.',
    path: ['customKey'],
  });

export type SaveDocumentInput = z.infer<typeof saveDocumentSchema>;

export const documentIdParamSchema = z.object({ id: objectIdSchema }).strict();
