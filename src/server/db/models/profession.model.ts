import { Schema, type Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './shared';
import {
  DOCUMENT_ACCEPTED_MIME,
  DOCUMENT_KEYS,
  DOCUMENT_MAX_SIZE_MB,
  PROFESSION_KINDS,
  validateRequirementsConsistency,
  type DocumentRequirement,
  type ProfessionKind,
} from '@/shared/constants/documents';

export interface ProfessionDocument {
  _id: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  slug: string;
  icon: string;
  isActive: boolean;
  order: number;
  servicesCount: number;

  /* ---- مفاتيح التحكم عالية المستوى (يضبطها Admin) ---- */
  professionKind: ProfessionKind;
  /** هل المهنة تحتاج مؤهل/شهادة مهنية؟ */
  requiresQualification: boolean;
  /** هل المهنة تحتاج ترخيص مزاولة؟ */
  requiresLicense: boolean;

  /** القائمة التي تُبنى منها شاشة المستندات (3/4) بالكامل. */
  documentRequirements: DocumentRequirement[];

  createdAt: Date;
  updatedAt: Date;
}

const documentRequirementSchema = new Schema<DocumentRequirement>(
  {
    key: { type: String, enum: DOCUMENT_KEYS, required: true },
    customKey: { type: String, trim: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 160 },
    required: { type: Boolean, required: true },
    order: { type: Number, required: true, min: 0 },
    accept: {
      type: [String],
      default: () => [...DOCUMENT_ACCEPTED_MIME],
      validate: {
        validator: (values: string[]) =>
          values.length > 0 &&
          values.every((v) => (DOCUMENT_ACCEPTED_MIME as readonly string[]).includes(v)),
        message: 'صيغة ملف غير مسموح بها.',
      },
    },
    maxSizeMB: { type: Number, default: DOCUMENT_MAX_SIZE_MB, min: 1, max: DOCUMENT_MAX_SIZE_MB },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

/** مستند CUSTOM يجب أن يحمل مفتاحًا مميزًا. */
documentRequirementSchema.pre('validate', async function validateCustomKey() {
  if (this.key === 'CUSTOM' && !this.customKey) {
    throw new Error('المستند المخصّص يجب أن يحمل customKey.');
  }
});

const professionSchema = new Schema<ProfessionDocument>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'الـslug يجب أن يحتوي حروفًا لاتينية صغيرة وأرقامًا وشرطات فقط.'],
    },
    icon: { type: String, required: true, trim: true, maxlength: 40 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    servicesCount: { type: Number, default: 0, min: 0 },

    professionKind: { type: String, enum: PROFESSION_KINDS, required: true, index: true },
    requiresQualification: { type: Boolean, required: true },
    requiresLicense: { type: Boolean, required: true },

    documentRequirements: {
      type: [documentRequirementSchema],
      required: true,
      validate: {
        validator: (list: DocumentRequirement[]) => list.length > 0,
        message: 'يجب تحديد مستند مطلوب واحد على الأقل.',
      },
    },
  },
  baseSchemaOptions
);

professionSchema.index({ slug: 1 }, { unique: true });
professionSchema.index({ categoryId: 1, isActive: 1, order: 1 });

/**
 * فرض قاعدة الاتساق على مستوى قاعدة البيانات.
 *
 * لا يمكن حفظ مهنة تخالف مفاتيح التحكم — مثل مهنة `requiresLicense: false`
 * تحمل `PRACTICE_LICENSE`، أو مهنة يكون فيها إثبات العنوان إلزاميًا.
 * هذا يمنع أي مسار (Admin أو seed أو سكربت) من إفساد البيانات.
 */
professionSchema.pre('validate', async function enforceConsistency() {
  const violations = validateRequirementsConsistency(this.documentRequirements ?? [], {
    requiresQualification: this.requiresQualification,
    requiresLicense: this.requiresLicense,
  });

  if (violations.length > 0) {
    throw new Error(
      `إعداد مستندات المهنة غير متسق: ${violations.map((v) => v.message).join(' ')}`
    );
  }
});

export const Profession = defineModel<ProfessionDocument>('Profession', professionSchema);
