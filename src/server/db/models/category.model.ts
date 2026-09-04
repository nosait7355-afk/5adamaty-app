import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './shared';

export interface CategoryDocument {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  /** اسم أيقونة lucide — يُحوَّل لمكوّن في الواجهة. */
  icon: string;
  color?: string;
  order: number;
  isActive: boolean;
  /** عدّاد مشتق يُحدَّث بـ$inc — أرخص من count() عند كل قراءة. */
  servicesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'الـslug يجب أن يحتوي حروفًا لاتينية صغيرة وأرقامًا وشرطات فقط.'],
    },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    icon: { type: String, required: true, trim: true, maxlength: 40 },
    color: { type: String, trim: true, maxlength: 20 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    servicesCount: { type: Number, default: 0, min: 0 },
  },
  baseSchemaOptions
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ isActive: 1, order: 1 });

export const Category = defineModel<CategoryDocument>('Category', categorySchema);
