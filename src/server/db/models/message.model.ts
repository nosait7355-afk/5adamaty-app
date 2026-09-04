import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel, mediaRefSchema, type MediaRef } from './shared';

/**
 * المراسلة — تبويب «الرسائل» في شريط المزوّد (الصور 25–29)
 * وأزرار «تواصل مع العميل» / «محادثة مع العميل».
 *
 * كل محادثة مرتبطة بطلب، فلا توجد رسائل خارج سياق طلب قائم.
 */

export interface ThreadDocument {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  participants: Types.ObjectId[];
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  /** عدد غير المقروء لكل مشارك: userId → count */
  unread: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const threadSchema = new Schema<ThreadDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: (list: Types.ObjectId[]) => list.length === 2,
        message: 'المحادثة تضم مشاركَين بالضبط.',
      },
    },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, trim: true, maxlength: 120 },
    unread: { type: Map, of: Number, default: () => new Map<string, number>() },
  },
  baseSchemaOptions
);

threadSchema.index({ orderId: 1 }, { unique: true });
threadSchema.index({ participants: 1, lastMessageAt: -1 });

export const Thread = defineModel<ThreadDocument>('Thread', threadSchema);

export interface MessageDocument {
  _id: Types.ObjectId;
  threadId: Types.ObjectId;
  orderId: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  body: string;
  attachments: MediaRef[];
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageDocument>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: 'Thread', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    attachments: {
      type: [mediaRefSchema],
      default: [],
      validate: {
        validator: (list: MediaRef[]) => list.length <= 3,
        message: 'الحد الأقصى 3 مرفقات لكل رسالة.',
      },
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  baseSchemaOptions
);

messageSchema.index({ threadId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, isRead: 1 });

/** المرسِل والمستقبِل لا يكونان الشخص نفسه. */
messageSchema.pre('validate', async function validateParticipants() {
  if (this.senderId?.equals(this.receiverId)) {
    throw new Error('لا يمكن إرسال رسالة إلى نفسك.');
  }
});

export const Message = defineModel<MessageDocument>('Message', messageSchema);
