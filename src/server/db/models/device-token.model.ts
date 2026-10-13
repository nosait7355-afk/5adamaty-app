import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './shared';

/**
 * رمز إشعارات جهاز (FCM) — جهاز واحد = رمز واحد، مرتبط بآخر حساب سجّل
 * دخوله عليه. يُحذف عند تسجيل الخروج وحذف الحساب، وحين ترفضه Firebase
 * (التطبيق حُذف من الجهاز)، وتلقائيًا بعد 90 يومًا بلا تجديد.
 *
 * ليس معرّف تتبّع: لا يُربط بإعلانات ولا يُستخدم لغير توصيل إشعارات
 * الحساب نفسه (سياسة الخصوصية — «رمز الإشعارات»).
 */
export interface DeviceTokenDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  platform: 'android';
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deviceTokenSchema = new Schema<DeviceTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, trim: true, maxlength: 4096 },
    platform: { type: String, enum: ['android'], default: 'android' },
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  baseSchemaOptions
);

deviceTokenSchema.index({ token: 1 }, { unique: true });
deviceTokenSchema.index({ userId: 1 });
deviceTokenSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const DeviceToken = defineModel<DeviceTokenDocument>('DeviceToken', deviceTokenSchema);
