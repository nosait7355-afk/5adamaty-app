import { z } from 'zod';
import { objectIdSchema, paginationSchema, safeString } from './common.schema';
import { REPORT_REASONS, REPORT_STATUSES } from '@/shared/constants/reports';

/** POST /providers/:id/report — نافذة «إبلاغ عن مقدم الخدمة». */
export const createReportSchema = z
  .object({
    reason: z.enum(REPORT_REASONS, { errorMap: () => ({ message: 'اختر سبب الإبلاغ.' }) }),
    details: safeString(500).optional(),
  })
  .strict();

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const listAdminReportsQuerySchema = paginationSchema
  .extend({ status: z.enum(REPORT_STATUSES).optional() })
  .strict();

/** قرار الإدارة — البلاغ يُغلق فقط، لا يُعاد فتحه. */
export const resolveReportSchema = z
  .object({ status: z.enum(['RESOLVED', 'DISMISSED']) })
  .strict();

export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

export const reportIdParamSchema = z.object({ id: objectIdSchema }).strict();
