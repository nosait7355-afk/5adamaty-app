import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './shared';

/* ============================================================
   Settings — إعدادات عامة يديرها Admin
   ============================================================ */

export interface SettingDocument {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
  description?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const settingSchema = new Schema<SettingDocument>(
  {
    key: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String, trim: true, maxlength: 300 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions
);

settingSchema.index({ key: 1 }, { unique: true });

export const Setting = defineModel<SettingDocument>('Setting', settingSchema);

/* ============================================================
   AuditLog — سجل الإجراءات الحسّاسة
   ============================================================ */

export const AUDIT_ACTIONS = [
  'PROVIDER_VERIFICATION_CHANGED',
  'ORDER_STATUS_CHANGED',
  'USER_STATUS_CHANGED',
  'PROFESSION_REQUIREMENTS_CHANGED',
  'DOCUMENT_REVIEWED',
  'REVIEW_HIDDEN',
  'LOGIN_FAILED',
  'PASSWORD_RESET',
  // Phase 10 — لوحة الإدارة
  'CATEGORY_CHANGED',
  'PROFESSION_CHANGED',
  'SERVICE_MODERATED',
  'REVIEW_MODERATED',
  'SETTING_CHANGED',
  'NOTIFICATION_BROADCAST',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLogDocument {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId;
  action: AuditAction;
  entityType: string;
  entityId?: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entityType: { type: String, required: true, trim: true, maxlength: 40 },
    entityId: { type: Schema.Types.ObjectId },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String, trim: true, maxlength: 45 },
    userAgent: { type: String, trim: true, maxlength: 300 },
  },
  baseSchemaOptions
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
// سجلات التدقيق تُحفظ سنتين
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

export const AuditLog = defineModel<AuditLogDocument>('AuditLog', auditLogSchema);

/* ============================================================
   FAQ — الأسئلة الشائعة في مركز المساعدة (الصورة 18)
   ============================================================ */

export const FAQ_TOPICS = [
  'ORDERS',
  'PAYMENT',
  'ACCOUNT',
  'PROVIDERS',
  'PROMOTIONS',
  'GENERAL',
] as const;

export type FaqTopic = (typeof FAQ_TOPICS)[number];

export const FAQ_TOPIC_LABELS_AR: Record<FaqTopic, string> = {
  ORDERS: 'الطلبات والحجوزات',
  PAYMENT: 'طرق الدفع والأسعار',
  ACCOUNT: 'الحساب والملف الشخصي',
  PROVIDERS: 'مقدمي الخدمة والتقييمات',
  PROMOTIONS: 'العروض والخصومات',
  GENERAL: 'عام',
};

export interface FaqDocument {
  _id: Types.ObjectId;
  question: string;
  answer: string;
  topic: FaqTopic;
  order: number;
  isActive: boolean;
  helpfulYes: number;
  helpfulNo: number;
  createdAt: Date;
  updatedAt: Date;
}

const faqSchema = new Schema<FaqDocument>(
  {
    question: { type: String, required: true, trim: true, maxlength: 200 },
    answer: { type: String, required: true, trim: true, maxlength: 1500 },
    topic: { type: String, enum: FAQ_TOPICS, required: true, index: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    helpfulYes: { type: Number, default: 0, min: 0 },
    helpfulNo: { type: Number, default: 0, min: 0 },
  },
  baseSchemaOptions
);

faqSchema.index({ topic: 1, isActive: 1, order: 1 });
faqSchema.index({ question: 'text', answer: 'text' }, { default_language: 'none' });

export const Faq = defineModel<FaqDocument>('Faq', faqSchema);
