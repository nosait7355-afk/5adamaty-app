import { Schema, model, models, type Model } from 'mongoose';

/**
 * تسجيل نموذج آمن مع Hot Reload.
 * بدون هذا يرمي Mongoose خطأ "Cannot overwrite model once compiled"
 * عند كل إعادة تحميل في التطوير.
 */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}

/**
 * مرجع ملف مخزّن في Cloudinary.
 *
 * NON-NEGOTIABLE (ARCHITECTURE §0 و§8): MongoDB يحتفظ بالـmetadata فقط.
 * ممنوع تخزين أي بايت من الصورة (Buffer أو Base64) داخل قاعدة البيانات.
 */
export interface MediaRef {
  publicId: string;
  url: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  /** `video` لمقاطع «سابقة أعمالي» — Cloudinary يخدمها من مسار مختلف. */
  resourceType: 'image' | 'raw' | 'video';
  accessMode: 'public' | 'authenticated';
  uploadedAt: Date;
}

export const mediaRefSchema = new Schema<MediaRef>(
  {
    publicId: { type: String, required: true, trim: true },
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        // الأصول تأتي من Cloudinary حصرًا
        validator: (value: string) => /^https:\/\/res\.cloudinary\.com\//.test(value),
        message: 'رابط الملف يجب أن يكون من Cloudinary.',
      },
    },
    format: { type: String, required: true, trim: true },
    bytes: { type: Number, required: true, min: 1 },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    resourceType: { type: String, enum: ['image', 'raw', 'video'], default: 'image' },
    accessMode: { type: String, enum: ['public', 'authenticated'], default: 'public' },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

/**
 * عنوان نصي بحت.
 *
 * NON-NEGOTIABLE (ARCHITECTURE §0.2): لا lat/lng، لا coordinates، لا GeoJSON،
 * ولا فهرس 2dsphere. الموقع نص فقط يُختار من قائمة مناطق الفيوم الثابتة.
 */
export interface TextAddress {
  governorate: string;
  city: string;
  area: string;
  line: string;
  landmark?: string;
  postalCode?: string;
}

export const textAddressSchema = new Schema<TextAddress>(
  {
    governorate: { type: String, required: true, trim: true, maxlength: 60 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    area: { type: String, required: true, trim: true, maxlength: 80 },
    line: { type: String, required: true, trim: true, maxlength: 200 },
    landmark: { type: String, trim: true, maxlength: 120 },
    postalCode: { type: String, trim: true, maxlength: 10 },
  },
  { _id: false }
);

/** خيارات موحّدة لكل الـSchemas. */
export const baseSchemaOptions = {
  timestamps: true,
  versionKey: false,
} as const;
