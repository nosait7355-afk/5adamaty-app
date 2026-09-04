import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './shared';

export interface ReviewDocument {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  rating: number;
  comment?: string;
  isVisible: boolean;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },

    rating: { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: 'التقييم يجب أن يكون رقمًا صحيحًا من 1 إلى 5.' } },
    comment: { type: String, trim: true, maxlength: 500 },

    isVisible: { type: Boolean, default: true },
    adminNote: { type: String, trim: true, maxlength: 300 },
  },
  baseSchemaOptions
);

/**
 * تقييم واحد لكل طلب — الفهرس الفريد يمنع التقييم المكرر على مستوى
 * قاعدة البيانات، لا على مستوى الخدمة فقط (PROJECT_PLAN — Phase 9).
 */
reviewSchema.index({ orderId: 1 }, { unique: true });
reviewSchema.index({ providerId: 1, isVisible: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, createdAt: -1 });

export const Review = defineModel<ReviewDocument>('Review', reviewSchema);
