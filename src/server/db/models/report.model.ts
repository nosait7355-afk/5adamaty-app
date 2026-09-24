import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './shared';
import {
  REPORT_REASONS,
  REPORT_STATUSES,
  type ReportReason,
  type ReportStatus,
} from '@/shared/constants/reports';

/**
 * بلاغ مستخدم عن مقدم خدمة — سياسة Google Play للمحتوى الذي ينشئه
 * المستخدمون (UGC) تشترط وسيلة إبلاغ داخل التطبيق عن المحتوى المسيء.
 *
 * البلاغ يصل للإدارة (`/admin/reports`) التي تقرّر: إيقاف الملف من صفحة
 * مقدمي الخدمات، ثم إغلاق البلاغ كـ«تمت المعالجة» أو «مرفوض».
 */
export interface ReportDocument {
  _id: Types.ObjectId;
  reporterId: Types.ObjectId;
  providerId: Types.ObjectId;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<ReportDocument>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: REPORT_STATUSES, default: 'OPEN', required: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  baseSchemaOptions
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ providerId: 1, status: 1 });
reportSchema.index({ reporterId: 1, providerId: 1, status: 1 });

export const Report = defineModel<ReportDocument>('Report', reportSchema);
