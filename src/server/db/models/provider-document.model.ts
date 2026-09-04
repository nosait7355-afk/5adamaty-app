import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel, mediaRefSchema, type MediaRef } from './shared';
import {
  DOCUMENT_KEYS,
  DOCUMENT_STATUSES,
  type DocumentKey,
  type DocumentStatus,
} from '@/shared/constants/documents';

export interface ProviderDocumentRecord {
  _id: Types.ObjectId;
  providerId: Types.ObjectId;
  requirementKey: DocumentKey;
  /** يميّز مستندات CUSTOM المتعددة لنفس المزوّد. */
  customKey?: string;
  label: string;
  media: MediaRef;
  status: DocumentStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const providerDocumentSchema = new Schema<ProviderDocumentRecord>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },
    requirementKey: { type: String, enum: DOCUMENT_KEYS, required: true },
    customKey: { type: String, trim: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 80 },

    /**
     * المستندات حسّاسة: تُرفع إلى Cloudinary بـ`accessMode: authenticated`
     * وتُقرأ عبر Signed URL مؤقّت فقط، ولا يُسلَّم رابطها المباشر للعميل
     * (ARCHITECTURE §8 — Phase 4).
     */
    media: { type: mediaRefSchema, required: true },

    status: { type: String, enum: DOCUMENT_STATUSES, default: 'PENDING', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
  },
  baseSchemaOptions
);

// مستند واحد لكل متطلّب لكل مزوّد (customKey يفصل مستندات CUSTOM)
providerDocumentSchema.index(
  { providerId: 1, requirementKey: 1, customKey: 1 },
  { unique: true }
);
providerDocumentSchema.index({ providerId: 1, status: 1 });

/** المستندات الحسّاسة يجب أن تُرفع كـauthenticated لا public. */
providerDocumentSchema.pre('validate', async function enforcePrivateAccess() {
  if (this.media && this.media.accessMode !== 'authenticated') {
    throw new Error('مستندات التوثيق يجب أن تُرفع بوضع وصول مُقيّد (authenticated).');
  }
});

export const ProviderDocument = defineModel<ProviderDocumentRecord>(
  'ProviderDocument',
  providerDocumentSchema
);
