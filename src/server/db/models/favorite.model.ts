import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './shared';

export interface FavoriteDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  providerId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const favoriteSchema = new Schema<FavoriteDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'ServiceProvider' },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
  },
  baseSchemaOptions
);

favoriteSchema.index({ userId: 1, providerId: 1 }, { unique: true, sparse: true });
favoriteSchema.index({ userId: 1, serviceId: 1 }, { unique: true, sparse: true });
favoriteSchema.index({ userId: 1, createdAt: -1 });

/** المفضلة تشير إلى مزوّد أو خدمة — أحدهما بالضبط. */
favoriteSchema.pre('validate', async function validateTarget() {
  const hasProvider = Boolean(this.providerId);
  const hasService = Boolean(this.serviceId);
  if (hasProvider === hasService) {
    throw new Error('يجب تحديد مقدم خدمة أو خدمة واحدة بالضبط.');
  }
});

export const Favorite = defineModel<FavoriteDocument>('Favorite', favoriteSchema);
