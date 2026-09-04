import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './shared';
import {
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPES,
  type NotificationEntityType,
  type NotificationType,
} from '@/shared/constants/notifications';

export interface NotificationDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  entityType: NotificationEntityType;
  entityId?: Types.ObjectId;
  /** رابط داخلي للانتقال عند النقر — «عرض التفاصيل» في الصورة 15. */
  actionUrl?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 400 },
    entityType: { type: String, enum: NOTIFICATION_ENTITY_TYPES, required: true },
    entityId: { type: Schema.Types.ObjectId },
    actionUrl: {
      type: String,
      trim: true,
      maxlength: 200,
      // روابط داخلية فقط — يمنع حقن روابط خارجية عبر الإشعارات
      match: [/^\/[\w\-/?=&%.]*$/, 'رابط الإجراء يجب أن يكون مسارًا داخليًا.'],
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  baseSchemaOptions
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// حذف تلقائي بعد 180 يومًا — يمنع تضخّم المجموعة بلا حدود
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export const Notification = defineModel<NotificationDocument>('Notification', notificationSchema);
