import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './shared';
import { ADDRESS_TYPES, type AddressType } from '@/shared/constants/fayoum-areas';

/**
 * عنوان العميل — شاشة «عناويني» (الصورة 17).
 *
 * NON-NEGOTIABLE (ARCHITECTURE §0.2): نص فقط. لا lat/lng، لا خريطة،
 * لا اختيار من خريطة، لا حساب مسافة. المنطقة تُختار من قائمة الفيوم الثابتة.
 */
export interface AddressDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  label: string;
  type: AddressType;
  governorate: string;
  city: string;
  area: string;
  line: string;
  landmark?: string;
  postalCode?: string;
  contactName: string;
  contactPhone: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<AddressDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: ADDRESS_TYPES, default: 'HOME' },

    governorate: { type: String, required: true, trim: true, maxlength: 60 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    area: { type: String, required: true, trim: true, maxlength: 80 },
    // 0/100 — عدّاد «العنوان التفصيلي» في الصورة 19
    line: { type: String, required: true, trim: true, maxlength: 200 },
    landmark: { type: String, trim: true, maxlength: 120 },
    postalCode: { type: String, trim: true, match: [/^\d{5}$/, 'الرمز البريدي يجب أن يكون 5 أرقام.'] },

    contactName: { type: String, required: true, trim: true, maxlength: 100 },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+201\d{9}$/, 'رقم الهاتف غير صالح.'],
    },

    isDefault: { type: Boolean, default: false },
  },
  baseSchemaOptions
);

addressSchema.index({ userId: 1, createdAt: -1 });
// عنوان افتراضي واحد لكل مستخدم
addressSchema.index(
  { userId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

export const Address = defineModel<AddressDocument>('Address', addressSchema);
