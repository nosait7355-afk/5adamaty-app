import { Schema, type Types } from 'mongoose';
import {
  baseSchemaOptions,
  defineModel,
  mediaRefSchema,
  textAddressSchema,
  type MediaRef,
  type TextAddress,
} from './shared';
import {
  ORDER_STATUSES,
  PAYMENT_METHOD,
  type OrderStatus,
  type PaymentMethod,
} from '@/shared/constants/order-status';
import { USER_ROLES, type UserRole } from '@/shared/constants/roles';

export interface StatusHistoryEntry {
  from: OrderStatus | null;
  to: OrderStatus;
  byUserId: Types.ObjectId;
  byRole: UserRole;
  note?: string;
  at: Date;
}

export interface ServiceRequestDocument {
  _id: Types.ObjectId;
  orderNumber: number;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  categoryId: Types.ObjectId;
  professionId: Types.ObjectId;

  serviceType: string;
  details: string;
  notes?: string;

  /** عنوان نصي بحت — لا إحداثيات ولا خرائط (ARCHITECTURE §0.2). */
  address: TextAddress;
  addressId?: Types.ObjectId;

  /** التاريخ إلزامي والوقت اختياري — مؤكَّد من الصورتين 11 و12. */
  scheduledDate: Date;
  preferredTimeFrom?: string;
  preferredTimeTo?: string;

  /** قيمة الخدمة المتفق عليها — للعرض والتوثيق فقط. */
  agreedPrice?: number;
  currency: 'EGP';

  /**
   * NON-NEGOTIABLE (ARCHITECTURE §0.1): قيمة واحدة ثابتة لا غير.
   * لا بوابات دفع ولا معاملات مالية — الدفع خارج التطبيق.
   */
  paymentMethod: PaymentMethod;
  /** علامة حالة تسجّل تأكيد المزوّد استلام المبلغ — ليست معاملة مالية. */
  cashReceivedConfirmed: boolean;
  cashConfirmedAt?: Date;

  attachments: MediaRef[];

  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  cancelledBy?: UserRole;
  cancellationReason?: string;
  reviewId?: Types.ObjectId;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const statusHistorySchema = new Schema<StatusHistoryEntry>(
  {
    from: { type: String, enum: [...ORDER_STATUSES, null], default: null },
    to: { type: String, enum: ORDER_STATUSES, required: true },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    byRole: { type: String, enum: USER_ROLES, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const serviceRequestSchema = new Schema<ServiceRequestDocument>(
  {
    orderNumber: { type: Number, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    professionId: { type: Schema.Types.ObjectId, ref: 'Profession', required: true },

    serviceType: { type: String, required: true, trim: true, maxlength: 120 },
    // 0/500 — عدّاد الصورة 11
    details: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 500 },

    address: { type: textAddressSchema, required: true },
    addressId: { type: Schema.Types.ObjectId, ref: 'Address' },

    scheduledDate: { type: Date, required: true },
    // وقت بصيغة HH:mm — نص لا Date، لأنه تفضيل لا موعد مطلق
    preferredTimeFrom: { type: String, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'صيغة الوقت غير صالحة.'] },
    preferredTimeTo: { type: String, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'صيغة الوقت غير صالحة.'] },

    agreedPrice: { type: Number, min: 0, max: 1_000_000 },
    currency: { type: String, enum: ['EGP'], default: 'EGP' },

    paymentMethod: {
      type: String,
      enum: [PAYMENT_METHOD],
      default: PAYMENT_METHOD,
      required: true,
    },
    cashReceivedConfirmed: { type: Boolean, default: false },
    cashConfirmedAt: { type: Date },

    attachments: {
      type: [mediaRefSchema],
      default: [],
      validate: {
        // «يمكنك إضافة حتى 5 صور» — الصورة 11
        validator: (list: MediaRef[]) => list.length <= 5,
        message: 'الحد الأقصى 5 صور مرفقة بالطلب.',
      },
    },

    status: { type: String, enum: ORDER_STATUSES, default: 'NEW', required: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
    cancelledBy: { type: String, enum: USER_ROLES },
    cancellationReason: { type: String, trim: true, maxlength: 300 },
    reviewId: { type: Schema.Types.ObjectId, ref: 'Review' },
    completedAt: { type: Date },
  },
  baseSchemaOptions
);

/* ---- الفهارس ---- */
serviceRequestSchema.index({ orderNumber: 1 }, { unique: true });
serviceRequestSchema.index({ customerId: 1, status: 1, createdAt: -1 });
serviceRequestSchema.index({ providerId: 1, status: 1, createdAt: -1 });
serviceRequestSchema.index({ status: 1, createdAt: -1 });

/**
 * لا يمكن إكمال طلب بدون تأكيد استلام المبلغ نقدًا (الصورتان 28 و29).
 * يُفرض على مستوى قاعدة البيانات لا الواجهة وحدها.
 */
serviceRequestSchema.pre('validate', async function enforceCompletionRules() {
  if (this.status === 'COMPLETED' && !this.cashReceivedConfirmed) {
    throw new Error('لا يمكن إكمال الطلب قبل تأكيد استلام المبلغ من العميل.');
  }
  if (this.preferredTimeFrom && this.preferredTimeTo) {
    if (this.preferredTimeFrom >= this.preferredTimeTo) {
      throw new Error('وقت البداية يجب أن يسبق وقت النهاية.');
    }
  }
});

export const ServiceRequest = defineModel<ServiceRequestDocument>(
  'ServiceRequest',
  serviceRequestSchema
);
