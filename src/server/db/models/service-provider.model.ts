import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel, mediaRefSchema, type MediaRef } from './shared';
import { VERIFICATION_STATUSES, type VerificationStatus } from '@/shared/constants/roles';

export interface ProviderVerification {
  status: VerificationStatus;
  /** رقم طلب التسجيل الظاهر في الصورة 23: SRV-2025-000123 */
  requestNumber: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  rejectionReason?: string;
}

export interface ServiceProviderDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  accountType: 'INDIVIDUAL' | 'COMPANY';
  displayName: string;
  categoryId: Types.ObjectId;
  professionId: Types.ObjectId;
  yearsOfExperience: number;
  bio: string;
  highlights: string[];
  /** مناطق التغطية — أسماء نصية من قائمة الفيوم الثابتة، لا إحداثيات. */
  coverageAreas: string[];
  priceMode: 'RANGE' | 'LATER';
  priceMin?: number;
  priceMax?: number;
  currency: 'EGP';
  gallery: MediaRef[];
  verification: ProviderVerification;
  isVerifiedBadge: boolean;
  isActive: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedOrders: number;
  customersCount: number;
  avgResponseMinutes?: number;
  memberSince: Date;
  profileCompletion: number;
  createdAt: Date;
  updatedAt: Date;
}

const verificationSchema = new Schema<ProviderVerification>(
  {
    status: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING_REVIEW' },
    requestNumber: { type: String, required: true, trim: true },
    submittedAt: { type: Date, default: () => new Date() },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const serviceProviderSchema = new Schema<ServiceProviderDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accountType: { type: String, enum: ['INDIVIDUAL', 'COMPANY'], default: 'INDIVIDUAL' },
    displayName: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },

    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    professionId: { type: Schema.Types.ObjectId, ref: 'Profession', required: true },
    yearsOfExperience: { type: Number, required: true, min: 0, max: 70 },

    // 0/300 — عدّاد الصورة 20
    bio: { type: String, required: true, trim: true, maxlength: 300 },
    // 0/200 — «ما يميّز خدمتك» في الصورة 20
    highlights: {
      type: [String],
      default: [],
      validate: {
        validator: (list: string[]) => list.length <= 6 && list.every((h) => h.length <= 200),
        message: 'الحد الأقصى 6 مزايا، كل منها 200 حرف.',
      },
    },

    coverageAreas: {
      type: [String],
      required: true,
      validate: {
        validator: (list: string[]) => list.length > 0 && list.length <= 20,
        message: 'اختر منطقة تغطية واحدة على الأقل (بحد أقصى 20).',
      },
    },

    priceMode: { type: String, enum: ['RANGE', 'LATER'], default: 'LATER' },
    priceMin: { type: Number, min: 0 },
    priceMax: { type: Number, min: 0 },
    // العملة ثابتة — لا معاملات مالية ولا تحويل عملات (ARCHITECTURE §0.1)
    currency: { type: String, enum: ['EGP'], default: 'EGP' },

    gallery: {
      type: [mediaRefSchema],
      default: [],
      validate: {
        validator: (list: MediaRef[]) => list.length <= 12,
        message: 'الحد الأقصى 12 صورة في المعرض.',
      },
    },

    verification: { type: verificationSchema, required: true },
    isVerifiedBadge: { type: Boolean, default: false },
    /** لا يصبح true إلا بعد اعتماد Admin. */
    isActive: { type: Boolean, default: false, index: true },

    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    completedOrders: { type: Number, default: 0, min: 0 },
    customersCount: { type: Number, default: 0, min: 0 },
    avgResponseMinutes: { type: Number, min: 0 },
    memberSince: { type: Date, default: () => new Date() },
    profileCompletion: { type: Number, default: 0, min: 0, max: 100 },
  },
  baseSchemaOptions
);

/*
 * الفهارس — مبنية على أشكال الاستعلام الفعلية في Phase 5.
 *
 * كل استعلام عام يبدأ بحارس الظهور `{ isActive, verification.status }`، لذا
 * يتصدّر الحارس كل فهرس مركّب (قاعدة ESR: المساواة أولًا ثم الترتيب ثم النطاق).
 * بدون ذلك يفقد المخطِّط الفهرس عند أول فلتر ويعود إلى مسح المجموعة.
 */
serviceProviderSchema.index({ userId: 1 }, { unique: true });
serviceProviderSchema.index({ 'verification.status': 1 });
serviceProviderSchema.index({ 'verification.requestNumber': 1 }, { unique: true });

// الترتيب الافتراضي: الأعلى تقييمًا
serviceProviderSchema.index({ isActive: 1, 'verification.status': 1, ratingAvg: -1, ratingCount: -1 });
// الفلترة بالتصنيف/المهنة ثم الترتيب بالتقييم
serviceProviderSchema.index({
  isActive: 1,
  'verification.status': 1,
  categoryId: 1,
  professionId: 1,
  ratingAvg: -1,
});
// الفلترة بالمنطقة النصية (فهرس متعدد المفاتيح على مصفوفة نصية — لا جغرافي)
serviceProviderSchema.index({ isActive: 1, 'verification.status': 1, coverageAreas: 1, ratingAvg: -1 });
// الترتيب بالسعر
serviceProviderSchema.index({ isActive: 1, 'verification.status': 1, priceMin: 1 });
serviceProviderSchema.index({ isActive: 1, 'verification.status': 1, priceMax: -1 });
// الترتيب بالأحدث
serviceProviderSchema.index({ isActive: 1, 'verification.status': 1, createdAt: -1 });

serviceProviderSchema.index({ displayName: 'text', bio: 'text' }, { default_language: 'none' });

/** نطاق السعر يجب أن يكون منطقيًا عند اختيار RANGE. */
serviceProviderSchema.pre('validate', async function validatePriceRange() {
  if (this.priceMode === 'RANGE') {
    if (this.priceMin == null || this.priceMax == null) {
      throw new Error('يجب تحديد الحد الأدنى والأقصى عند اختيار سعر تقريبي.');
    }
    if (this.priceMin > this.priceMax) {
      throw new Error('الحد الأدنى للسعر يجب ألا يتجاوز الحد الأقصى.');
    }
  }
});

export const ServiceProvider = defineModel<ServiceProviderDocument>(
  'ServiceProvider',
  serviceProviderSchema
);
