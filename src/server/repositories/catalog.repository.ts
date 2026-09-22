import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { Category, Profession } from '@/server/db/models';
import type { CategoryDocument } from '@/server/db/models/category.model';
import type { ProfessionDocument } from '@/server/db/models/profession.model';

/**
 * طبقة الوصول للبيانات — تعزل Mongoose عن الخدمات.
 * كل دالة تضمن الاتصال أولًا وتستخدم `lean()` للقراءة (أخف وأسرع).
 */

export type CategoryLean = Omit<CategoryDocument, '_id'> & { _id: Types.ObjectId };
export type ProfessionLean = Omit<ProfessionDocument, '_id'> & { _id: Types.ObjectId };

export async function findCategories(options: { includeInactive?: boolean } = {}) {
  await connectToDatabase();
  const filter = options.includeInactive ? {} : { isActive: true };
  return Category.find(filter).sort({ order: 1, name: 1 }).lean<CategoryLean[]>();
}

export async function findCategoryBySlug(slug: string) {
  await connectToDatabase();
  return Category.findOne({ slug, isActive: true }).lean<CategoryLean | null>();
}

export async function findProfessions(options: {
  categoryId?: string | undefined;
  includeInactive?: boolean;
}) {
  await connectToDatabase();

  const filter: Record<string, unknown> = options.includeInactive ? {} : { isActive: true };
  if (options.categoryId) {
    filter.categoryId = new Types.ObjectId(options.categoryId);
  }

  return Profession.find(filter).sort({ order: 1, name: 1 }).lean<ProfessionLean[]>();
}

export async function findProfessionById(id: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return Profession.findOne({ _id: new Types.ObjectId(id) }).lean<ProfessionLean | null>();
}

export async function findProfessionBySlug(slug: string) {
  await connectToDatabase();
  return Profession.findOne({ slug, isActive: true }).lean<ProfessionLean | null>();
}

/* ================================================================== */
/* كتابة الإدارة (Phase 10)                                            */
/*                                                                      */
/* هذه الدوال هي المسار **الوحيد** الذي يُنشئ أو يعدّل تصنيفًا أو مهنة.  */
/* كل استدعاء منها يمرّ عبر `requireRole(request, 'ADMIN')` في الـroute  */
/* ويُسجَّل في auditLogs من طبقة الخدمة — لا من هنا.                    */
/* ================================================================== */

export async function findCategoryById(id: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return Category.findById(id).lean<CategoryLean | null>();
}

export async function categorySlugExists(slug: string, excludeId?: string): Promise<boolean> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { slug };
  /*
   * `$ne` هنا مُولَّد من الكود لا من إدخال المستخدم، لكن `sanitizeFilter`
   * العام (ARCHITECTURE §7) يجرّد أي مفتاح `$` بلا تمييز — `mongoose.trusted`
   * يعلن صراحةً أن هذا المُعامل موثوق فيه.
   */
  if (excludeId) filter._id = mongoose.trusted({ $ne: new Types.ObjectId(excludeId) });
  return Boolean(await Category.exists(filter));
}

export async function createCategoryRecord(data: Partial<CategoryDocument>) {
  await connectToDatabase();
  const created = await Category.create(data);
  return created.toObject() as CategoryLean;
}

export async function updateCategoryRecord(id: string, patch: Record<string, unknown>) {
  await connectToDatabase();
  return Category.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after', runValidators: true }).lean<
    CategoryLean | null
  >();
}

/** عدد المهن المرتبطة بتصنيف — يمنع حذفه أو تعطيله وهو يحمل مهنًا نشطة بلا علم الإدارة. */
export async function countProfessionsInCategory(categoryId: string): Promise<number> {
  await connectToDatabase();
  return Profession.countDocuments({ categoryId: new Types.ObjectId(categoryId) });
}

export async function professionSlugExists(slug: string, excludeId?: string): Promise<boolean> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { slug };
  if (excludeId) filter._id = mongoose.trusted({ $ne: new Types.ObjectId(excludeId) });
  return Boolean(await Profession.exists(filter));
}

/**
 * ينشئ مهنة.
 *
 * `create()` لا `insertMany()` عمدًا — يُشغِّل `pre('validate')` في
 * `profession.model.ts` الذي يفرض قاعدة اتساق المستندات (ARCHITECTURE §3.3)
 * فيرفض أي تعارض بين `requiresQualification/requiresLicense` وقائمة
 * `documentRequirements` قبل أن تصل البيانات لقاعدة البيانات.
 */
export async function createProfessionRecord(data: Record<string, unknown>) {
  await connectToDatabase();
  const created = await Profession.create(data);
  return created.toObject() as ProfessionLean;
}

/**
 * يعدّل مهنة — عبر `findById` + `save()` لا `findByIdAndUpdate()`.
 *
 * السبب: `findByIdAndUpdate` بمعامل `$set` **لا يُشغّل** `pre('validate')`
 * على المستند الكامل بصورة موثوقة عند تعديل مصفوفات فرعية معقّدة مثل
 * `documentRequirements` مع `runValidators`؛ التحميل والحفظ يضمن فحص
 * الاتساق دائمًا على النسخة الكاملة بعد الدمج.
 */
export async function updateProfessionRecord(id: string, patch: Record<string, unknown>) {
  await connectToDatabase();
  const doc = await Profession.findById(id);
  if (!doc) return null;

  Object.assign(doc, patch);
  await doc.save();
  return doc.toObject() as ProfessionLean;
}

export async function findAllCategoriesForAdmin() {
  await connectToDatabase();
  return Category.find({}).sort({ order: 1, name: 1 }).lean<CategoryLean[]>();
}

export async function findAllProfessionsForAdmin(options: {
  categoryId?: string | undefined;
  includeInactive: boolean;
}) {
  await connectToDatabase();
  const filter: Record<string, unknown> = options.includeInactive ? {} : { isActive: true };
  if (options.categoryId) filter.categoryId = new Types.ObjectId(options.categoryId);
  return Profession.find(filter).sort({ order: 1, name: 1 }).lean<ProfessionLean[]>();
}
