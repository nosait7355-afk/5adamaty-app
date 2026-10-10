import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel, mediaRefSchema, type MediaRef } from './shared';
import { BANNER_ARTS, BANNER_TONES, type BannerArt, type BannerTone } from '@/shared/constants/banners';

export interface BannerDocument {
  _id: Types.ObjectId;
  /** للبانرات الافتراضية فقط — يمنع إنشاءها مرتين. */
  key?: string;
  title: string;
  description: string;
  ctaLabel: string;
  /** مسار داخل التطبيق (BANNER_HREF_PATTERN). */
  href: string;
  tone: BannerTone;
  /** رسمة مضمّنة — تُستخدم ما لم تُرفع صورة. */
  art?: BannerArt | null;
  /** صورة رفعتها الإدارة — تغلب الرسمة. */
  image?: MediaRef | null;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<BannerDocument>(
  {
    key: { type: String, trim: true, maxlength: 40 },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 160, default: '' },
    ctaLabel: { type: String, required: true, trim: true, maxlength: 24 },
    href: { type: String, required: true, trim: true, maxlength: 200 },
    tone: { type: String, enum: BANNER_TONES, default: 'brand' },
    art: { type: String, enum: [...BANNER_ARTS, null], default: null },
    image: { type: mediaRefSchema, required: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions
);

bannerSchema.index({ key: 1 }, { unique: true, sparse: true });
bannerSchema.index({ isActive: 1, order: 1 });

export const Banner = defineModel<BannerDocument>('Banner', bannerSchema);
