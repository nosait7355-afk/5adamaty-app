import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel, mediaRefSchema, type MediaRef } from './shared';
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from '@/shared/constants/roles';

export interface RefreshTokenEntry {
  /** يُخزَّن مُجزّأً — لا يُحفظ التوكن الخام إطلاقًا. */
  hash: string;
  userAgent?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface UserDocument {
  _id: Types.ObjectId;
  role: UserRole;
  fullName: string;
  phone?: string;
  email?: string;
  passwordHash: string;
  avatar?: MediaRef;
  status: UserStatus;
  /**
   * التوثيق يدوي من Admin — لا OTP إطلاقًا (PROJECT_PLAN — المصادقة).
   * لا يوجد أي مسار في النظام يضبط هذه القيم عبر رسالة نصية أو كود تحقق.
   */
  phoneVerified: boolean;
  emailVerified: boolean;
  gender?: 'MALE' | 'FEMALE';
  birthDate?: Date;
  governorate?: string;
  city?: string;
  area?: string;
  /** «العنوان التفصيلي (0/100)» في الصورة 19 — نص حر لا إحداثيات. */
  addressLine?: string;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  refreshTokens: RefreshTokenEntry[];
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenEntry>(
  {
    hash: { type: String, required: true },
    userAgent: { type: String, maxlength: 300 },
    createdAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const userSchema = new Schema<UserDocument>(
  {
    role: { type: String, enum: USER_ROLES, required: true, index: true },
    fullName: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },

    // E.164 مصري: +20 ثم 1 ثم 9 أرقام
    phone: {
      type: String,
      trim: true,
      match: [/^\+201\d{9}$/, 'رقم الهاتف غير صالح.'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'البريد الإلكتروني غير صالح.'],
    },

    // `select: false` = لا يخرج في أي استعلام ما لم يُطلب صراحةً.
    // خط الدفاع الأول ضد تسريب بيانات الاعتماد (ARCHITECTURE §7).
    passwordHash: { type: String, required: true, select: false },

    avatar: { type: mediaRefSchema, required: false },
    status: { type: String, enum: USER_STATUSES, default: 'ACTIVE', index: true },

    phoneVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },

    gender: { type: String, enum: ['MALE', 'FEMALE'] },
    birthDate: { type: Date },

    // عنوان نصي فقط — لا إحداثيات (ARCHITECTURE §0.2)
    governorate: { type: String, trim: true, maxlength: 60 },
    city: { type: String, trim: true, maxlength: 60 },
    area: { type: String, trim: true, maxlength: 80, index: true },
    addressLine: { type: String, trim: true, maxlength: 100 },

    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date },

    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  baseSchemaOptions
);

/* ---- الفهارس ---- */
// sparse: يسمح بعدة مستندات بلا هاتف/بريد مع بقاء التفرّد للقيم الموجودة
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, status: 1 });

/** يجب وجود هاتف أو بريد على الأقل — لأن الدخول بأحدهما. */
userSchema.pre('validate', async function validateIdentifier() {
  if (!this.phone && !this.email) {
    throw new Error('يجب إدخال رقم هاتف أو بريد إلكتروني على الأقل.');
  }
});

export const User = defineModel<UserDocument>('User', userSchema);

/**
 * الحقول الآمنة للإرجاع للعميل.
 * تُستخدم كـprojection افتراضية في المستودع.
 */
export const USER_PUBLIC_FIELDS =
  'role fullName phone email avatar status phoneVerified emailVerified gender governorate city area createdAt';
