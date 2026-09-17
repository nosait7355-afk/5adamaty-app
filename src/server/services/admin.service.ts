import { Types } from 'mongoose';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import { writeAuditLog, createNotification } from '@/server/repositories/provider.repository';
import {
  broadcastNotificationRecords,
  findReviewByIdForAdmin,
  findServiceByIdForAdmin,
  findUserByIdForAdmin,
  getDashboardCounts,
  listAuditLogsForAdmin,
  listReviewsForAdmin,
  listServicesForAdmin,
  listSettingsRecords,
  listUsersForAdmin,
  refreshProviderRatingFromVisibleReviews,
  setReviewVisibilityRecord,
  setServiceActiveRecord,
  setUserStatusRecord,
  upsertSettingRecord,
  type DashboardCounts,
} from '@/server/repositories/admin.repository';
import {
  categorySlugExists,
  countProfessionsInCategory,
  createCategoryRecord,
  createProfessionRecord,
  findAllCategoriesForAdmin,
  findAllProfessionsForAdmin,
  findCategoryById,
  findProfessionById,
  professionSlugExists,
  updateCategoryRecord,
  updateProfessionRecord,
} from '@/server/repositories/catalog.repository';
import { validateRequirementsConsistency } from '@/shared/constants/documents';
import type {
  BroadcastNotificationInput,
  CreateCategoryInput,
  CreateProfessionInput,
  SetReviewVisibilityInput,
  SetServiceActiveInput,
  SetUserStatusInput,
  UpdateCategoryInput,
  UpdateProfessionInput,
  UpsertSettingInput,
} from '@/shared/schemas/admin.schema';
import { formatDate } from '@/lib/format';

/**
 * خدمة لوحة الإدارة (Phase 10).
 *
 * كل دالة كتابة هنا تُسجَّل في `auditLogs` **قبل** أن تعود — لا استثناء.
 * هذا هو المسار الوحيد المصرَّح له بتعديل التصنيفات والمهن ومتطلبات
 * مستنداتها وحالة المستخدمين وإظهار الخدمات والتقييمات.
 */

interface AdminActor {
  id: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

/* ================================================================== */
/* لوحة القيادة                                                        */
/* ================================================================== */

export type DashboardDto = DashboardCounts;

export async function getDashboard(): Promise<DashboardDto> {
  return getDashboardCounts();
}

/* ================================================================== */
/* المستخدمون                                                          */
/* ================================================================== */

export interface AdminUserDto {
  id: string;
  role: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: string;
  area?: string;
  createdAt: string;
  lastLoginAt?: string;
}

function toAdminUserDto(user: {
  _id: Types.ObjectId;
  role: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: string;
  area?: string;
  createdAt: Date;
  lastLoginAt?: Date;
}): AdminUserDto {
  return {
    id: String(user._id),
    role: user.role,
    fullName: user.fullName,
    ...(user.phone ? { phone: user.phone } : {}),
    ...(user.email ? { email: user.email } : {}),
    status: user.status,
    ...(user.area ? { area: user.area } : {}),
    createdAt: user.createdAt.toISOString(),
    ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}),
  };
}

export async function listUsers(options: {
  page: number;
  limit: number;
  role?: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | undefined;
  status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING_REVIEW' | 'REJECTED' | undefined;
  q?: string | undefined;
}) {
  const { items, total } = await listUsersForAdmin(options);
  return { items: items.map((item) => toAdminUserDto(item)), total };
}

/**
 * يوقف أو يفعّل حساب مستخدم.
 *
 * قيدان: (1) الإدارة لا توقف نفسها — يمنع قفل النظام بالخطأ. (2) توقيف
 * عميل أو مزوّد لا يُبطل جلساته تلقائيًا هنا؛ `requireAuth` يفحص الحالة
 * في كل طلب لاحق فيرفضه فور أول استخدام للتوكن (ARCHITECTURE §7).
 */
export async function setUserStatus(
  actor: AdminActor,
  userId: string,
  input: SetUserStatusInput
): Promise<AdminUserDto> {
  if (userId === actor.id) {
    throw forbidden('لا يمكنك تغيير حالة حسابك الخاص.');
  }

  const user = await findUserByIdForAdmin(userId);
  if (!user) throw notFound('المستخدم غير موجود.');
  if (user.role === 'ADMIN') {
    throw forbidden('لا يمكن تعديل حالة حساب إداري من هنا.');
  }

  const updated = await setUserStatusRecord(userId, input.status);
  if (!updated) throw notFound('المستخدم غير موجود.');

  await writeAuditLog({
    actorId: actor.id,
    action: 'USER_STATUS_CHANGED',
    entityType: 'User',
    entityId: userId,
    before: { status: user.status },
    after: { status: input.status, reason: input.reason },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  if (input.status === 'SUSPENDED') {
    await createNotification({
      userId,
      type: 'SYSTEM',
      title: 'تم إيقاف حسابك',
      body: input.reason
        ? `تم إيقاف حسابك من الإدارة. السبب: ${input.reason}`
        : 'تم إيقاف حسابك من الإدارة. تواصل مع الدعم لمزيد من التفاصيل.',
      entityType: 'SYSTEM',
    });
  }

  logger.info('تغيّرت حالة مستخدم من الإدارة', {
    adminId: actor.id,
    userId,
    status: input.status,
  });

  return toAdminUserDto(updated);
}

/* ================================================================== */
/* التصنيفات                                                           */
/* ================================================================== */

export interface AdminCategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color?: string;
  order: number;
  isActive: boolean;
  servicesCount: number;
}

function toAdminCategoryDto(category: {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color?: string;
  order: number;
  isActive: boolean;
  servicesCount: number;
}): AdminCategoryDto {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    ...(category.color ? { color: category.color } : {}),
    order: category.order,
    isActive: category.isActive,
    servicesCount: category.servicesCount,
  };
}

export async function listCategoriesForAdmin(): Promise<AdminCategoryDto[]> {
  const items = await findAllCategoriesForAdmin();
  return items.map(toAdminCategoryDto);
}

export async function createCategory(
  actor: AdminActor,
  input: CreateCategoryInput
): Promise<AdminCategoryDto> {
  if (await categorySlugExists(input.slug)) {
    throw conflict('يوجد تصنيف بهذا الـslug بالفعل.');
  }

  const created = await createCategoryRecord({
    name: input.name,
    slug: input.slug,
    description: input.description,
    icon: input.icon,
    ...(input.color ? { color: input.color } : {}),
    order: input.order,
    isActive: true,
    servicesCount: 0,
  });

  await writeAuditLog({
    actorId: actor.id,
    action: 'CATEGORY_CHANGED',
    entityType: 'Category',
    entityId: String(created._id),
    before: null,
    after: { name: input.name, slug: input.slug },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  logger.info('أُنشئ تصنيف من الإدارة', { adminId: actor.id, categoryId: String(created._id) });
  return toAdminCategoryDto(created);
}

export async function updateCategory(
  actor: AdminActor,
  categoryId: string,
  input: UpdateCategoryInput
): Promise<AdminCategoryDto> {
  const existing = await findCategoryById(categoryId);
  if (!existing) throw notFound('التصنيف غير موجود.');

  if (input.slug && input.slug !== existing.slug) {
    if (await categorySlugExists(input.slug, categoryId)) {
      throw conflict('يوجد تصنيف آخر بهذا الـslug بالفعل.');
    }
  }

  /*
   * تعطيل تصنيف يحمل مهنًا نشطة يُخفي كل خدماتها من الاكتشاف فجأة —
   * قرار جسيم يتطلب تأكيدًا واعيًا لا نقرة عرضية. نرفضه إن وُجدت مهن
   * ونطلب من الإدارة تعطيلها أولًا أو تأكيد القصد صراحة.
   */
  if (input.isActive === false && existing.isActive) {
    const professionsCount = await countProfessionsInCategory(categoryId);
    if (professionsCount > 0) {
      throw unprocessable(
        `هذا التصنيف يحتوي ${professionsCount} مهنة. عطّل مهنه أولًا قبل تعطيل التصنيف نفسه.`
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.description !== undefined) patch.description = input.description;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.order !== undefined) patch.order = input.order;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  const updated = await updateCategoryRecord(categoryId, patch);
  if (!updated) throw notFound('التصنيف غير موجود.');

  await writeAuditLog({
    actorId: actor.id,
    action: 'CATEGORY_CHANGED',
    entityType: 'Category',
    entityId: categoryId,
    before: { name: existing.name, isActive: existing.isActive },
    after: { name: updated.name, isActive: updated.isActive },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  return toAdminCategoryDto(updated);
}

/* ================================================================== */
/* المهن + متطلبات المستندات الديناميكية                                */
/* ================================================================== */

export interface AdminProfessionDto {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  icon: string;
  order: number;
  isActive: boolean;
  servicesCount: number;
  professionKind: string;
  requiresQualification: boolean;
  requiresLicense: boolean;
  documentRequirements: Array<{
    key: string;
    customKey?: string;
    label: string;
    description: string;
    required: boolean;
    order: number;
    accept: string[];
    maxSizeMB: number;
    isActive: boolean;
  }>;
}

function toAdminProfessionDto(profession: {
  _id: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  slug: string;
  icon: string;
  order: number;
  isActive: boolean;
  servicesCount: number;
  professionKind: string;
  requiresQualification: boolean;
  requiresLicense: boolean;
  documentRequirements: AdminProfessionDto['documentRequirements'];
}): AdminProfessionDto {
  return {
    id: String(profession._id),
    categoryId: String(profession.categoryId),
    name: profession.name,
    slug: profession.slug,
    icon: profession.icon,
    order: profession.order,
    isActive: profession.isActive,
    servicesCount: profession.servicesCount,
    professionKind: profession.professionKind,
    requiresQualification: profession.requiresQualification,
    requiresLicense: profession.requiresLicense,
    documentRequirements: profession.documentRequirements,
  };
}

export async function listProfessionsForAdmin(options: {
  categoryId?: string | undefined;
  includeInactive: boolean;
}): Promise<AdminProfessionDto[]> {
  const items = await findAllProfessionsForAdmin(options);
  return items.map((item) => toAdminProfessionDto(item as never));
}

/**
 * ينشئ مهنة جديدة — بما فيها قائمة متطلبات مستنداتها الكاملة.
 *
 * يتحقق من قاعدة الاتساق **قبل** الكتابة (رسالة أوضح للإدارة من رمي
 * الـSchema)، وقاعدة البيانات تعيد التحقق مرة أخرى كخط دفاع ثانٍ لا يمكن
 * تجاوزه من أي مسار آخر يُنشئ مهنة مستقبلًا.
 */
export async function createProfession(
  actor: AdminActor,
  input: CreateProfessionInput
): Promise<AdminProfessionDto> {
  const category = await findCategoryById(input.categoryId);
  if (!category) throw notFound('التصنيف المحدد غير موجود.');

  if (await professionSlugExists(input.slug)) {
    throw conflict('توجد مهنة بهذا الـslug بالفعل.');
  }

  const violations = validateRequirementsConsistency(input.documentRequirements, {
    requiresQualification: input.requiresQualification,
    requiresLicense: input.requiresLicense,
  });
  if (violations.length > 0) {
    throw unprocessable(
      `إعداد مستندات المهنة غير متسق: ${violations.map((v) => v.message).join(' ')}`
    );
  }

  const created = await createProfessionRecord({
    categoryId: new Types.ObjectId(input.categoryId),
    name: input.name,
    slug: input.slug,
    icon: input.icon,
    order: input.order,
    isActive: true,
    servicesCount: 0,
    professionKind: input.professionKind,
    requiresQualification: input.requiresQualification,
    requiresLicense: input.requiresLicense,
    documentRequirements: input.documentRequirements,
  });

  await writeAuditLog({
    actorId: actor.id,
    action: 'PROFESSION_CHANGED',
    entityType: 'Profession',
    entityId: String(created._id),
    before: null,
    after: { name: input.name, documentRequirements: input.documentRequirements.length },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  logger.info('أُنشئت مهنة من الإدارة', { adminId: actor.id, professionId: String(created._id) });
  return toAdminProfessionDto(created as never);
}

/**
 * يعدّل مهنة — بما فيها متطلبات مستنداتها.
 *
 * **هذا هو المسار الذي يجعل الشاشة 21 ديناميكية فعليًا**: أي تغيير هنا
 * (إضافة مستند، تبديل `required`، تفعيل/تعطيل مؤهل أو ترخيص) ينعكس فورًا
 * على شاشة تسجيل مقدمي الخدمة القادمين بلا نشر كود (PROJECT_PLAN — قواعد
 * المستندات الديناميكية).
 */
export async function updateProfession(
  actor: AdminActor,
  professionId: string,
  input: UpdateProfessionInput
): Promise<AdminProfessionDto> {
  const existing = await findProfessionById(professionId);
  if (!existing) throw notFound('المهنة غير موجودة.');

  if (input.slug && input.slug !== existing.slug) {
    if (await professionSlugExists(input.slug, professionId)) {
      throw conflict('توجد مهنة أخرى بهذا الـslug بالفعل.');
    }
  }

  if (input.categoryId) {
    const category = await findCategoryById(input.categoryId);
    if (!category) throw notFound('التصنيف المحدد غير موجود.');
  }

  const nextRequiresQualification = input.requiresQualification ?? existing.requiresQualification;
  const nextRequiresLicense = input.requiresLicense ?? existing.requiresLicense;
  const nextRequirements = input.documentRequirements ?? existing.documentRequirements;

  const violations = validateRequirementsConsistency(nextRequirements, {
    requiresQualification: nextRequiresQualification,
    requiresLicense: nextRequiresLicense,
  });
  if (violations.length > 0) {
    throw unprocessable(
      `إعداد مستندات المهنة غير متسق: ${violations.map((v) => v.message).join(' ')}`
    );
  }

  const patch: Record<string, unknown> = {};
  if (input.categoryId !== undefined) patch.categoryId = new Types.ObjectId(input.categoryId);
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.order !== undefined) patch.order = input.order;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.professionKind !== undefined) patch.professionKind = input.professionKind;
  if (input.requiresQualification !== undefined) {
    patch.requiresQualification = input.requiresQualification;
  }
  if (input.requiresLicense !== undefined) patch.requiresLicense = input.requiresLicense;
  if (input.documentRequirements !== undefined) {
    patch.documentRequirements = input.documentRequirements;
  }

  const updated = await updateProfessionRecord(professionId, patch);
  if (!updated) throw notFound('المهنة غير موجودة.');

  await writeAuditLog({
    actorId: actor.id,
    action: 'PROFESSION_REQUIREMENTS_CHANGED',
    entityType: 'Profession',
    entityId: professionId,
    before: {
      requiresQualification: existing.requiresQualification,
      requiresLicense: existing.requiresLicense,
      documentRequirementsCount: existing.documentRequirements.length,
    },
    after: {
      requiresQualification: updated.requiresQualification,
      requiresLicense: updated.requiresLicense,
      documentRequirementsCount: updated.documentRequirements.length,
    },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  logger.info('عُدِّلت متطلبات مستندات مهنة من الإدارة', {
    adminId: actor.id,
    professionId,
  });

  return toAdminProfessionDto(updated as never);
}

/* ================================================================== */
/* الخدمات (إشراف)                                                     */
/* ================================================================== */

export async function listServices(options: {
  page: number;
  limit: number;
  q?: string | undefined;
  isActive?: boolean | undefined;
  providerId?: string | undefined;
}) {
  const { items, total } = await listServicesForAdmin(options);
  return {
    items: items.map((item) => ({
      id: String(item._id),
      providerId: String(item.providerId),
      title: item.title,
      isActive: item.isActive,
      ratingAvg: item.ratingAvg,
      ratingCount: item.ratingCount,
      ordersCount: item.ordersCount,
      createdAt: item.createdAt.toISOString(),
    })),
    total,
  };
}

/**
 * يخفي أو يُظهر خدمة.
 *
 * الإخفاء لا يحذف السجل ولا يمسّ الطلبات القائمة عليها — يمنع ظهورها في
 * الاكتشاف فقط (نفس حارس `isActive` المستخدم في مستودع الاكتشاف).
 */
export async function setServiceActive(
  actor: AdminActor,
  serviceId: string,
  input: SetServiceActiveInput
) {
  const existing = await findServiceByIdForAdmin(serviceId);
  if (!existing) throw notFound('الخدمة غير موجودة.');

  const updated = await setServiceActiveRecord(serviceId, input.isActive);
  if (!updated) throw notFound('الخدمة غير موجودة.');

  await writeAuditLog({
    actorId: actor.id,
    action: 'SERVICE_MODERATED',
    entityType: 'Service',
    entityId: serviceId,
    before: { isActive: existing.isActive },
    after: { isActive: input.isActive, reason: input.reason },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  return {
    id: String(updated._id),
    isActive: updated.isActive,
  };
}

/* ================================================================== */
/* التقييمات (إشراف)                                                   */
/* ================================================================== */

export async function listReviews(options: {
  page: number;
  limit: number;
  isVisible?: boolean | undefined;
  providerId?: string | undefined;
}) {
  const { items, total } = await listReviewsForAdmin(options);
  return {
    items: items.map((item) => {
      const doc = item as unknown as {
        _id: Types.ObjectId;
        orderId: Types.ObjectId;
        customerId: Types.ObjectId;
        providerId: Types.ObjectId;
        rating: number;
        comment?: string;
        isVisible: boolean;
        adminNote?: string;
        createdAt: Date;
      };
      return {
        id: String(doc._id),
        orderId: String(doc.orderId),
        providerId: String(doc.providerId),
        rating: doc.rating,
        ...(doc.comment ? { comment: doc.comment } : {}),
        isVisible: doc.isVisible,
        ...(doc.adminNote ? { adminNote: doc.adminNote } : {}),
        createdAt: doc.createdAt.toISOString(),
      };
    }),
    total,
  };
}

/**
 * يخفي أو يُظهر تقييمًا.
 *
 * التقييم لا يُحذف أبدًا — الإخفاء فقط، حفاظًا على أثر التدقيق. متوسط
 * تقييم المزوّد **يُعاد حسابه من المراجعات الظاهرة فعليًا** لا بـ`$inc`،
 * فلا ينحرف العدّاد أبدًا عن البيانات الحقيقية (نفس مبدأ Phase 9).
 */
export async function setReviewVisibility(
  actor: AdminActor,
  reviewId: string,
  input: SetReviewVisibilityInput
) {
  const existing = await findReviewByIdForAdmin(reviewId);
  if (!existing) throw notFound('التقييم غير موجود.');

  const doc = existing as unknown as { providerId: Types.ObjectId; isVisible: boolean };

  const updated = await setReviewVisibilityRecord(reviewId, input.isVisible, input.adminNote);
  if (!updated) throw notFound('التقييم غير موجود.');

  await refreshProviderRatingFromVisibleReviews(doc.providerId);

  await writeAuditLog({
    actorId: actor.id,
    action: 'REVIEW_MODERATED',
    entityType: 'Review',
    entityId: reviewId,
    before: { isVisible: doc.isVisible },
    after: { isVisible: input.isVisible, adminNote: input.adminNote },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  return { id: reviewId, isVisible: input.isVisible };
}

/* ================================================================== */
/* الإعدادات العامة                                                    */
/* ================================================================== */

export async function listSettings() {
  const items = await listSettingsRecords();
  return items.map((item) => {
    const doc = item as unknown as {
      _id: Types.ObjectId;
      key: string;
      value: unknown;
      description?: string;
      updatedAt: Date;
    };
    return {
      id: String(doc._id),
      key: doc.key,
      value: doc.value,
      ...(doc.description ? { description: doc.description } : {}),
      updatedAt: doc.updatedAt.toISOString(),
    };
  });
}

export async function upsertSetting(actor: AdminActor, input: UpsertSettingInput) {
  const updated = await upsertSettingRecord(input.key, input.value, input.description, actor.id);
  if (!updated) throw badRequest('تعذّر حفظ الإعداد.');

  await writeAuditLog({
    actorId: actor.id,
    action: 'SETTING_CHANGED',
    entityType: 'Setting',
    entityId: String((updated as { _id: Types.ObjectId })._id),
    after: { key: input.key, value: input.value },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  return { key: input.key, value: input.value };
}

/* ================================================================== */
/* البث العام (Notifications)                                          */
/* ================================================================== */

export async function broadcastNotification(
  actor: AdminActor,
  input: BroadcastNotificationInput
): Promise<{ recipientsCount: number }> {
  const recipientsCount = await broadcastNotificationRecords(input);

  await writeAuditLog({
    actorId: actor.id,
    action: 'NOTIFICATION_BROADCAST',
    entityType: 'Notification',
    after: {
      audience: input.audience,
      type: input.type,
      title: input.title,
      recipientsCount,
      at: formatDate(new Date()),
    },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  logger.info('بُثّ إشعار عام من الإدارة', {
    adminId: actor.id,
    audience: input.audience,
    recipientsCount,
  });

  return { recipientsCount };
}

/* ================================================================== */
/* سجل التدقيق                                                         */
/* ================================================================== */

export async function listAuditLogs(options: {
  page: number;
  limit: number;
  entityType?: string | undefined;
  action?: import('@/server/db/models/misc.model').AuditAction | undefined;
}) {
  const { items, total } = await listAuditLogsForAdmin(options);
  return {
    items: items.map((item) => {
      const doc = item as unknown as {
        _id: Types.ObjectId;
        actorId?: Types.ObjectId;
        action: string;
        entityType: string;
        entityId?: Types.ObjectId;
        before?: unknown;
        after?: unknown;
        createdAt: Date;
      };
      return {
        id: String(doc._id),
        ...(doc.actorId ? { actorId: String(doc.actorId) } : {}),
        action: doc.action,
        entityType: doc.entityType,
        ...(doc.entityId ? { entityId: String(doc.entityId) } : {}),
        before: doc.before,
        after: doc.after,
        createdAt: doc.createdAt.toISOString(),
      };
    }),
    total,
  };
}
