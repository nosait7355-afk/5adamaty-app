import { conflict, forbidden, notFound, unprocessable } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import { hashPassword } from '@/server/lib/password';
import { issueSession, toAuthUserDto, type AuthUserDto, type SessionTokens } from './auth.service';
import { existsByPhoneOrEmail } from '@/server/repositories/user.repository';
import {
  countProviderDocuments,
  createNotification,
  createProviderAccount,
  findProviderById,
  findProviderByUserId,
  findUserById,
  listProvidersByVerificationStatus,
  nextRequestNumber,
  updateProvider,
  updateUser,
  writeAuditLog,
  type ProviderLean,
  type UserLean,
} from '@/server/repositories/provider.repository';
import { listDocumentsByProvider } from '@/server/repositories/document.repository';
import { findProfessionById } from '@/server/repositories/catalog.repository';
import type {
  RegisterProviderInput,
  UpdateProviderProfileInput,
  VerificationDecisionInput,
} from '@/shared/schemas/provider.schema';
import { GOVERNORATE } from '@/shared/constants/fayoum-areas';
import { VERIFICATION_LABELS_AR, type VerificationStatus } from '@/shared/constants/roles';

/**
 * تسجيل مقدم الخدمة والتوثيق (Phase 6) — الصور 19 إلى 23.
 *
 * ثلاث قواعد أمنية تحكم هذا الملف:
 *   1. `verification.status` و`isVerifiedBadge` و`isActive` لا تُكتب إلا من
 *      `decideVerification` التي تتطلب ADMIN. لا يوجد مسار آخر يمسّها.
 *   2. كل قرار توثيق يُسجَّل في `auditLogs` قبل أن تعود الاستجابة.
 *   3. المزوّد غير المعتمد لا يستقبل طلبات — الحارس دالة واحدة
 *      (`assertCanAcceptOrders`) تستدعيها Phase 8 عند كل قبول طلب.
 */

/* ================================================================== */
/* أشكال الإخراج                                                       */
/* ================================================================== */

export interface ProviderProfileDto {
  id: string;
  displayName: string;
  accountType: string;
  categoryId: string;
  professionId: string;
  yearsOfExperience: number;
  bio: string;
  highlights: string[];
  coverageAreas: string[];
  priceMode: string;
  priceMin?: number;
  priceMax?: number;
  currency: string;
  /** حالة التوثيق — للقراءة فقط من جهة المزوّد. */
  verification: {
    status: VerificationStatus;
    statusLabel: string;
    requestNumber: string;
    submittedAt?: string;
    reviewedAt?: string;
    rejectionReason?: string;
  };
  isVerifiedBadge: boolean;
  isActive: boolean;
  profileCompletion: number;
  /** هل يستطيع استقبال الطلبات الآن — تُقرأ في Phase 7/8. */
  canAcceptOrders: boolean;
  documents: {
    uploaded: number;
    requiredTotal: number;
    missingRequired: string[];
    isComplete: boolean;
  };
  user: AuthUserDto;
}

export interface AdminProviderListItemDto {
  id: string;
  displayName: string;
  professionId: string;
  categoryId: string;
  status: VerificationStatus;
  requestNumber: string;
  submittedAt?: string;
  documentsCount: number;
  profileCompletion: number;
  contact: { fullName: string; phone?: string; email?: string };
}

/* ================================================================== */
/* اكتمال الملف                                                        */
/* ================================================================== */

export interface CompletionInput {
  bio?: string | undefined;
  coverageAreas?: string[] | undefined;
  highlights?: string[] | undefined;
  priceMode?: string | undefined;
  yearsOfExperience?: number | undefined;
  galleryCount: number;
  email?: string | undefined;
  addressLine?: string | undefined;
  requiredDocumentsTotal: number;
  requiredDocumentsUploaded: number;
}

/**
 * نسبة اكتمال الملف (0–100) — حلقة النسبة في الصورة 24.
 *
 * دالة خالصة بلا وصول لقاعدة البيانات لتُختبر وحدويًا. الأوزان تعكس أهمية
 * كل قسم في ظهور المزوّد للعميل: المستندات وحدها 30% لأنها شرط الاعتماد،
 * والمعرض 10% لأنه تحسين لا شرط.
 */
export function computeProfileCompletion(input: CompletionInput): number {
  const checks: { weight: number; done: boolean }[] = [
    { weight: 10, done: Boolean(input.email) },
    { weight: 10, done: Boolean(input.addressLine) },
    { weight: 10, done: (input.yearsOfExperience ?? 0) >= 0 && input.yearsOfExperience != null },
    { weight: 15, done: (input.bio?.length ?? 0) >= 20 },
    { weight: 15, done: (input.coverageAreas?.length ?? 0) > 0 },
    { weight: 5, done: (input.highlights?.length ?? 0) > 0 },
    { weight: 5, done: input.priceMode === 'RANGE' },
    { weight: 10, done: input.galleryCount > 0 },
    {
      weight: 20,
      done:
        input.requiredDocumentsTotal > 0 &&
        input.requiredDocumentsUploaded >= input.requiredDocumentsTotal,
    },
  ];

  const total = checks.reduce((sum, check) => sum + (check.done ? check.weight : 0), 0);
  return Math.min(100, Math.round(total));
}

/* ================================================================== */
/* حالة المستندات                                                      */
/* ================================================================== */

/**
 * يقارن المستندات المرفوعة بمتطلبات المهنة.
 *
 * المصدر الوحيد للمتطلبات هو إعدادات المهنة في قاعدة البيانات — لا قائمة
 * ثابتة في الكود. لذلك «مستندات السبّاك ≠ مستندات الطبيب» تلقائيًا.
 */
async function getDocumentsState(provider: ProviderLean) {
  const profession = await findProfessionById(String(provider.professionId));
  if (!profession) throw notFound('المهنة المرتبطة بحسابك غير موجودة.');

  const requirements = profession.documentRequirements
    .filter((item) => item.isActive)
    .sort((a, b) => a.order - b.order);

  const documents = await listDocumentsByProvider(String(provider._id));
  const uploadedKeys = new Set(
    documents.map((doc) => `${doc.requirementKey}:${doc.customKey ?? ''}`)
  );

  const required = requirements.filter((item) => item.required);
  const missingRequired = required
    .filter((item) => !uploadedKeys.has(`${item.key}:${item.customKey ?? ''}`))
    .map((item) => item.label);

  return {
    uploaded: documents.length,
    requiredTotal: required.length,
    requiredUploaded: required.length - missingRequired.length,
    missingRequired,
    isComplete: missingRequired.length === 0,
  };
}

/* ================================================================== */
/* التسجيل                                                             */
/* ================================================================== */

/**
 * ينشئ حساب مقدم الخدمة بعد الخطوة 2/4.
 *
 * الحالة الناتجة `DRAFT` لا `PENDING_REVIEW`: الطلب لم يُرسَل بعد، فلا
 * يظهر في طابور الإدارة ولا يُحسب في مدة الاستجابة. رقم الطلب يُولَّد هنا
 * لأن الفهرس الفريد يشترط وجوده، ولا يُعرض للمزوّد إلا بعد الإرسال.
 */
export async function registerProvider(
  input: RegisterProviderInput,
  meta: { userAgent?: string }
): Promise<{ user: AuthUserDto; providerId: string; tokens: SessionTokens }> {
  const { step1, step2 } = input;

  const taken = await existsByPhoneOrEmail({ phone: step1.phone, email: step1.email });
  if (taken.phone) {
    throw conflict('رقم الهاتف مسجّل بالفعل. سجّل الدخول أو استخدم رقمًا آخر.');
  }
  if (taken.email) {
    throw conflict('البريد الإلكتروني مسجّل بالفعل. سجّل الدخول أو استخدم بريدًا آخر.');
  }

  const profession = await findProfessionById(step2.professionId);
  if (!profession) throw notFound('التخصص المطلوب غير موجود.');

  // المهنة يجب أن تنتمي فعلًا للتصنيف المُرسَل — وإلا تناقض الهرمية
  if (String(profession.categoryId) !== step2.categoryId) {
    throw unprocessable('التخصص المختار لا ينتمي للتصنيف المحدد.');
  }

  const passwordHash = await hashPassword(step1.password);
  const requestNumber = await nextRequestNumber();

  const { user, provider } = await createProviderAccount({
    user: {
      role: 'PROVIDER',
      fullName: step1.fullName,
      phone: step1.phone,
      email: step1.email,
      passwordHash,
      // الحساب لا يصير ACTIVE إلا باعتماد الإدارة
      status: 'PENDING_REVIEW',
      governorate: step1.governorate || GOVERNORATE,
      city: step1.city,
      addressLine: step1.addressLine,
      ...(step1.gender ? { gender: step1.gender } : {}),
      ...(step1.birthDate ? { birthDate: new Date(step1.birthDate) } : {}),
    },
    provider: {
      accountType: step1.accountType,
      displayName: step1.fullName,
      categoryId: profession.categoryId,
      professionId: profession._id,
      yearsOfExperience: step2.yearsOfExperience,
      bio: step2.bio,
      highlights: step2.highlights,
      coverageAreas: step2.coverageAreas,
      priceMode: step2.priceMode,
      ...(step2.priceMode === 'RANGE'
        ? { priceMin: step2.priceMin, priceMax: step2.priceMax }
        : {}),
      isActive: false,
      isVerifiedBadge: false,
      profileCompletion: 0,
      verification: {
        status: 'DRAFT',
        requestNumber,
        submittedAt: new Date(),
      },
    },
  });

  await refreshProfileCompletion(provider, user);

  const tokens = await issueSession(user, { userAgent: meta.userAgent, remember: true });

  logger.info('أُنشئ حساب مقدم خدمة (مسودة)', {
    userId: String(user._id),
    providerId: String(provider._id),
  });

  return { user: toAuthUserDto(user), providerId: String(provider._id), tokens };
}

/* ================================================================== */
/* ملف المزوّد الحالي                                                   */
/* ================================================================== */

async function requireOwnProvider(userId: string): Promise<ProviderLean> {
  const provider = await findProviderByUserId(userId);
  if (!provider) throw forbidden('لا يوجد ملف مقدّم خدمة مرتبط بحسابك.');
  return provider;
}

/** يعيد حساب نسبة الاكتمال ويحفظها. */
async function refreshProfileCompletion(
  provider: ProviderLean,
  user: UserLean
): Promise<number> {
  const documents = await getDocumentsState(provider);

  const completion = computeProfileCompletion({
    bio: provider.bio,
    coverageAreas: provider.coverageAreas,
    highlights: provider.highlights,
    priceMode: provider.priceMode,
    yearsOfExperience: provider.yearsOfExperience,
    galleryCount: provider.gallery?.length ?? 0,
    email: user.email,
    addressLine: user.addressLine,
    requiredDocumentsTotal: documents.requiredTotal,
    requiredDocumentsUploaded: documents.requiredUploaded,
  });

  await updateProvider(String(provider._id), { profileCompletion: completion });
  return completion;
}

export async function getMyProviderProfile(userId: string): Promise<ProviderProfileDto> {
  const provider = await requireOwnProvider(userId);
  const user = await findUserById(userId);
  if (!user) throw notFound('الحساب غير موجود.');

  const documents = await getDocumentsState(provider);
  const completion = await refreshProfileCompletion(provider, user);

  return {
    id: String(provider._id),
    displayName: provider.displayName,
    accountType: provider.accountType,
    categoryId: String(provider.categoryId),
    professionId: String(provider.professionId),
    yearsOfExperience: provider.yearsOfExperience,
    bio: provider.bio,
    highlights: provider.highlights ?? [],
    coverageAreas: provider.coverageAreas ?? [],
    priceMode: provider.priceMode,
    ...(provider.priceMin != null ? { priceMin: provider.priceMin } : {}),
    ...(provider.priceMax != null ? { priceMax: provider.priceMax } : {}),
    currency: provider.currency,
    verification: {
      status: provider.verification.status,
      statusLabel: VERIFICATION_LABELS_AR[provider.verification.status],
      requestNumber: provider.verification.requestNumber,
      ...(provider.verification.submittedAt
        ? { submittedAt: provider.verification.submittedAt.toISOString() }
        : {}),
      ...(provider.verification.reviewedAt
        ? { reviewedAt: provider.verification.reviewedAt.toISOString() }
        : {}),
      ...(provider.verification.rejectionReason
        ? { rejectionReason: provider.verification.rejectionReason }
        : {}),
    },
    isVerifiedBadge: provider.isVerifiedBadge,
    isActive: provider.isActive,
    profileCompletion: completion,
    canAcceptOrders: canAcceptOrders(provider),
    documents: {
      uploaded: documents.uploaded,
      requiredTotal: documents.requiredTotal,
      missingRequired: documents.missingRequired,
      isComplete: documents.isComplete,
    },
    user: toAuthUserDto(user as never),
  };
}

/**
 * تعديل بيانات الملف من أزرار «تعديل» في شاشة المراجعة (الصورة 22).
 *
 * التعديل ممنوع بعد إرسال الطلب: الإدارة تراجع نسخة ثابتة. يُسمح به في
 * `DRAFT` و`RESUBMISSION_REQUIRED` فقط.
 */
export async function updateMyProviderProfile(
  userId: string,
  patch: UpdateProviderProfileInput
): Promise<ProviderProfileDto> {
  const provider = await requireOwnProvider(userId);

  const editable: VerificationStatus[] = ['DRAFT', 'RESUBMISSION_REQUIRED'];
  if (!editable.includes(provider.verification.status)) {
    throw forbidden('لا يمكن تعديل البيانات أثناء المراجعة أو بعد اعتماد الحساب.');
  }

  /* ---- حقول المستخدم ---- */
  const userPatch: Record<string, unknown> = {};
  if (patch.fullName !== undefined) userPatch.fullName = patch.fullName;
  if (patch.email !== undefined) userPatch.email = patch.email;
  if (patch.city !== undefined) userPatch.city = patch.city;
  if (patch.addressLine !== undefined) userPatch.addressLine = patch.addressLine;
  if (patch.gender !== undefined) userPatch.gender = patch.gender;
  if (patch.birthDate !== undefined) userPatch.birthDate = new Date(patch.birthDate);

  if (patch.email) {
    const taken = await existsByPhoneOrEmail({ email: patch.email });
    const current = await findUserById(userId);
    if (taken.email && current?.email !== patch.email) {
      throw conflict('البريد الإلكتروني مسجّل بالفعل.');
    }
  }

  /* ---- حقول الملف ---- */
  const providerPatch: Record<string, unknown> = {};
  if (patch.fullName !== undefined) providerPatch.displayName = patch.fullName;
  if (patch.accountType !== undefined) providerPatch.accountType = patch.accountType;
  if (patch.yearsOfExperience !== undefined) {
    providerPatch.yearsOfExperience = patch.yearsOfExperience;
  }
  if (patch.bio !== undefined) providerPatch.bio = patch.bio;
  if (patch.coverageAreas !== undefined) providerPatch.coverageAreas = patch.coverageAreas;
  if (patch.highlights !== undefined) providerPatch.highlights = patch.highlights;

  if (patch.priceMode !== undefined) {
    providerPatch.priceMode = patch.priceMode;
    if (patch.priceMode === 'RANGE') {
      if (patch.priceMin == null || patch.priceMax == null) {
        throw unprocessable('حدّد السعر من وإلى عند اختيار سعر تقريبي.');
      }
      providerPatch.priceMin = patch.priceMin;
      providerPatch.priceMax = patch.priceMax;
    } else {
      providerPatch.priceMin = undefined;
      providerPatch.priceMax = undefined;
    }
  }

  /*
   * تغيير المهنة يغيّر قائمة المستندات المطلوبة كليًا (سبّاك ← طبيب)،
   * فالمستندات المرفوعة قد تصير غير مطلوبة أو تنقص أخرى. لا نحذف شيئًا
   * هنا: فحص الاكتمال عند الإرسال هو ما يمنع طلبًا ناقصًا من المرور.
   */
  if (patch.professionId !== undefined) {
    const profession = await findProfessionById(patch.professionId);
    if (!profession) throw notFound('التخصص المطلوب غير موجود.');
    if (patch.categoryId && String(profession.categoryId) !== patch.categoryId) {
      throw unprocessable('التخصص المختار لا ينتمي للتصنيف المحدد.');
    }
    providerPatch.professionId = profession._id;
    providerPatch.categoryId = profession.categoryId;
  }

  if (Object.keys(userPatch).length > 0) await updateUser(userId, userPatch);
  if (Object.keys(providerPatch).length > 0) {
    await updateProvider(String(provider._id), providerPatch);
  }

  return getMyProviderProfile(userId);
}

/* ================================================================== */
/* إرسال الطلب — الخطوة 4/4                                            */
/* ================================================================== */

export async function submitVerification(
  userId: string,
  meta: { ip?: string; userAgent?: string }
): Promise<ProviderProfileDto> {
  const provider = await requireOwnProvider(userId);

  const submittable: VerificationStatus[] = ['DRAFT', 'RESUBMISSION_REQUIRED'];
  if (!submittable.includes(provider.verification.status)) {
    throw conflict(
      provider.verification.status === 'PENDING_REVIEW'
        ? 'طلبك قيد المراجعة بالفعل.'
        : 'لا يمكن إرسال الطلب في حالته الحالية.'
    );
  }

  /*
   * الفحص الحاسم: اكتمال المستندات يُتحقق منه **على الخادم**، لا بتعطيل
   * زر «التالي» في الواجهة فقط. طلب ينقصه مستند إلزامي يُرفض هنا مهما
   * فعل العميل.
   */
  const documents = await getDocumentsState(provider);
  if (!documents.isComplete) {
    throw unprocessable(
      `ينقص طلبك مستندات إلزامية: ${documents.missingRequired.join('، ')}.`
    );
  }

  await updateProvider(String(provider._id), {
    'verification.status': 'PENDING_REVIEW',
    'verification.submittedAt': new Date(),
    'verification.rejectionReason': undefined,
  });

  await writeAuditLog({
    actorId: userId,
    action: 'PROVIDER_VERIFICATION_CHANGED',
    entityType: 'ServiceProvider',
    entityId: String(provider._id),
    before: { status: provider.verification.status },
    after: { status: 'PENDING_REVIEW' },
    ...(meta.ip ? { ip: meta.ip } : {}),
    ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
  });

  await createNotification({
    userId,
    type: 'PROVIDER_REGISTRATION_SUBMITTED',
    title: 'تم إرسال طلب التسجيل',
    body: `طلبك رقم ${provider.verification.requestNumber} قيد المراجعة. سنخطرك بالنتيجة خلال 24–48 ساعة عمل.`,
    entityType: 'PROVIDER',
    entityId: String(provider._id),
    actionUrl: '/provider/pending-review',
  });

  logger.info('أُرسل طلب توثيق مقدم خدمة', {
    providerId: String(provider._id),
    requestNumber: provider.verification.requestNumber,
  });

  return getMyProviderProfile(userId);
}

/* ================================================================== */
/* حارس استقبال الطلبات                                                 */
/* ================================================================== */

/** هل يستطيع المزوّد استقبال الطلبات؟ معتمد ونشط فقط. */
export function canAcceptOrders(provider: {
  verification: { status: VerificationStatus };
  isActive: boolean;
}): boolean {
  return provider.verification.status === 'APPROVED' && provider.isActive;
}

/**
 * الحارس الذي تستدعيه Phase 7/8 قبل إسناد أي طلب أو قبوله.
 *
 * وُضع هنا لا في طبقة الطلبات ليكون قاعدة واحدة لا تُكرَّر: أي مسار يمسّ
 * طلبًا يمرّ عليه، فلا يمكن لمزوّد قيد المراجعة أن يستقبل عملًا.
 */
export function assertCanAcceptOrders(provider: {
  verification: { status: VerificationStatus };
  isActive: boolean;
}): void {
  if (!canAcceptOrders(provider)) {
    throw forbidden('لا يمكن استقبال الطلبات قبل اعتماد حسابك من الإدارة.');
  }
}

/* ================================================================== */
/* الإدارة                                                             */
/* ================================================================== */

export async function listVerificationQueue(options: {
  status: VerificationStatus;
  page: number;
  limit: number;
}): Promise<{ items: AdminProviderListItemDto[]; total: number }> {
  const { items, total } = await listProvidersByVerificationStatus(options);

  const enriched = await Promise.all(
    items.map(async (provider) => ({
      id: String(provider._id),
      displayName: provider.displayName,
      professionId: String(provider.professionId),
      categoryId: String(provider.categoryId),
      status: provider.verification.status,
      requestNumber: provider.verification.requestNumber,
      ...(provider.verification.submittedAt
        ? { submittedAt: provider.verification.submittedAt.toISOString() }
        : {}),
      documentsCount: await countProviderDocuments(String(provider._id)),
      profileCompletion: provider.profileCompletion,
      /*
       * بيانات الاتصال تظهر للإدارة وحدها — هذا المسار محروس بـADMIN،
       * وهو المكان الوحيد في النظام الذي يخرج فيه هاتف المزوّد أو بريده.
       */
      contact: {
        fullName: provider.user?.fullName ?? provider.displayName,
        ...(provider.user?.phone ? { phone: provider.user.phone } : {}),
        ...(provider.user?.email ? { email: provider.user.email } : {}),
      },
    }))
  );

  return { items: enriched, total };
}

export async function getProviderForAdmin(providerId: string) {
  const provider = await findProviderById(providerId);
  if (!provider) throw notFound('مقدم الخدمة المطلوب غير موجود.');

  const user = await findUserById(String(provider.userId));
  const documents = await listDocumentsByProvider(providerId);
  const state = await getDocumentsState(provider);
  const profession = await findProfessionById(String(provider.professionId));

  return {
    id: String(provider._id),
    displayName: provider.displayName,
    accountType: provider.accountType,
    bio: provider.bio,
    highlights: provider.highlights ?? [],
    coverageAreas: provider.coverageAreas ?? [],
    yearsOfExperience: provider.yearsOfExperience,
    priceMode: provider.priceMode,
    ...(provider.priceMin != null ? { priceMin: provider.priceMin } : {}),
    ...(provider.priceMax != null ? { priceMax: provider.priceMax } : {}),
    professionName: profession?.name ?? '',
    verification: {
      status: provider.verification.status,
      statusLabel: VERIFICATION_LABELS_AR[provider.verification.status],
      requestNumber: provider.verification.requestNumber,
      submittedAt: provider.verification.submittedAt?.toISOString(),
      reviewedAt: provider.verification.reviewedAt?.toISOString(),
      rejectionReason: provider.verification.rejectionReason,
    },
    profileCompletion: provider.profileCompletion,
    isActive: provider.isActive,
    contact: {
      fullName: user?.fullName ?? provider.displayName,
      phone: user?.phone,
      email: user?.email,
      city: user?.city,
      addressLine: user?.addressLine,
    },
    /*
     * المستندات تُعاد بمعرّفاتها وحالتها فقط. الرابط لا يُرسل هنا إطلاقًا:
     * تطلبه الواجهة من `/provider/documents/:id/url` فيُولَّد رابط موقّت
     * قصير العمر عند الحاجة (ARCHITECTURE §8).
     */
    documents: documents.map((doc) => ({
      id: String(doc._id),
      requirementKey: doc.requirementKey,
      label: doc.label,
      status: doc.status,
      format: doc.media.format,
      bytes: doc.media.bytes,
      uploadedAt: doc.createdAt.toISOString(),
    })),
    documentsState: state,
  };
}

/**
 * قرار الإدارة على طلب التوثيق.
 *
 * هذه الدالة هي **المسار الوحيد** في النظام الذي يكتب `verification.status`
 * أو `isVerifiedBadge` أو `isActive`، وهي محروسة بـADMIN على مستوى المسار.
 */
export async function decideVerification(
  admin: { id: string },
  providerId: string,
  decision: VerificationDecisionInput,
  meta: { ip?: string; userAgent?: string }
): Promise<{ id: string; status: VerificationStatus; requestNumber: string }> {
  const provider = await findProviderById(providerId);
  if (!provider) throw notFound('مقدم الخدمة المطلوب غير موجود.');

  if (provider.verification.status === 'DRAFT') {
    throw conflict('لم يُرسل هذا الطلب بعد، فلا يمكن اتخاذ قرار بشأنه.');
  }

  const approved = decision.status === 'APPROVED';

  await updateProvider(providerId, {
    'verification.status': decision.status,
    'verification.reviewedAt': new Date(),
    'verification.reviewedBy': admin.id,
    'verification.rejectionReason': approved ? undefined : decision.reason,
    // الاعتماد وحده يفتح الظهور في البحث ويمنح الشارة
    isActive: approved,
    isVerifiedBadge: approved,
  });

  await updateUser(String(provider.userId), {
    status: approved ? 'ACTIVE' : decision.status === 'REJECTED' ? 'REJECTED' : 'PENDING_REVIEW',
  });

  await writeAuditLog({
    actorId: admin.id,
    action: 'PROVIDER_VERIFICATION_CHANGED',
    entityType: 'ServiceProvider',
    entityId: providerId,
    before: {
      status: provider.verification.status,
      isActive: provider.isActive,
      isVerifiedBadge: provider.isVerifiedBadge,
    },
    after: { status: decision.status, isActive: approved, isVerifiedBadge: approved },
    ...(meta.ip ? { ip: meta.ip } : {}),
    ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
  });

  const notification = buildDecisionNotification(decision, provider.verification.requestNumber);
  await createNotification({
    userId: String(provider.userId),
    ...notification,
    entityType: 'PROVIDER',
    entityId: providerId,
  });

  logger.info('قرار توثيق مقدم خدمة', {
    providerId,
    adminId: admin.id,
    status: decision.status,
  });

  return {
    id: providerId,
    status: decision.status,
    requestNumber: provider.verification.requestNumber,
  };
}

function buildDecisionNotification(
  decision: VerificationDecisionInput,
  requestNumber: string
): {
  type: 'PROVIDER_APPROVED' | 'PROVIDER_REJECTED' | 'PROVIDER_RESUBMISSION_REQUIRED';
  title: string;
  body: string;
  actionUrl: string;
} {
  if (decision.status === 'APPROVED') {
    return {
      type: 'PROVIDER_APPROVED',
      title: 'تم اعتماد حسابك',
      body: `تهانينا! تم اعتماد طلبك رقم ${requestNumber}. أصبح ملفك ظاهرًا للعملاء ويمكنك استقبال الطلبات.`,
      actionUrl: '/provider/dashboard',
    };
  }

  if (decision.status === 'REJECTED') {
    return {
      type: 'PROVIDER_REJECTED',
      title: 'تم رفض طلب التسجيل',
      body: `طلبك رقم ${requestNumber} مرفوض. السبب: ${decision.reason ?? '—'}`,
      actionUrl: '/provider/pending-review',
    };
  }

  return {
    type: 'PROVIDER_RESUBMISSION_REQUIRED',
    title: 'مطلوب تعديل طلب التسجيل',
    body: `طلبك رقم ${requestNumber} يحتاج تعديلًا. السبب: ${decision.reason ?? '—'}`,
    actionUrl: '/register/provider',
  };
}
