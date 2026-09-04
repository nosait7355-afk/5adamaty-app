import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel, mediaRefSchema, type MediaRef } from './shared';

export interface ServiceDocument {
  _id: Types.ObjectId;
  providerId: Types.ObjectId;
  categoryId: Types.ObjectId;
  professionId: Types.ObjectId;
  title: string;
  description: string;
  /** «بيدأ من 150 ج.م» في الصورة 09 — سعر للعرض فقط، لا تحصيل داخل التطبيق. */
  priceFrom: number;
  priceTo?: number;
  currency: 'EGP';
  images: MediaRef[];
  areas: string[];
  isActive: boolean;
  ordersCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<ServiceDocument>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    professionId: { type: Schema.Types.ObjectId, ref: 'Profession', required: true },

    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 500 },

    priceFrom: { type: Number, required: true, min: 0, max: 1_000_000 },
    priceTo: { type: Number, min: 0, max: 1_000_000 },
    currency: { type: String, enum: ['EGP'], default: 'EGP' },

    images: {
      type: [mediaRefSchema],
      default: [],
      validate: {
        validator: (list: MediaRef[]) => list.length <= 8,
        message: 'الحد الأقصى 8 صور للخدمة.',
      },
    },

    areas: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    ordersCount: { type: Number, default: 0, min: 0 },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  baseSchemaOptions
);

/*
 * الفهارس — `isActive` يتصدّر كل فهرس مركّب لأنه شرط مساواة في كل استعلام
 * اكتشاف (قاعدة ESR)، يليه مفتاح الفلترة ثم مفتاح الترتيب.
 */
serviceSchema.index({ isActive: 1, providerId: 1 });
serviceSchema.index({ isActive: 1, categoryId: 1, professionId: 1, ratingAvg: -1 });
serviceSchema.index({ isActive: 1, ratingAvg: -1, ratingCount: -1 });
serviceSchema.index({ isActive: 1, priceFrom: 1 });
serviceSchema.index({ isActive: 1, areas: 1, ratingAvg: -1 });
serviceSchema.index({ isActive: 1, createdAt: -1 });
serviceSchema.index({ title: 'text', description: 'text' }, { default_language: 'none' });

serviceSchema.pre('validate', async function validatePrice() {
  if (this.priceTo != null && this.priceTo < this.priceFrom) {
    throw new Error('السعر الأقصى يجب ألا يقل عن السعر الأدنى.');
  }
});

export const Service = defineModel<ServiceDocument>('Service', serviceSchema);
