import { randomUUID } from 'node:crypto';
import { conflict, forbidden, unauthorized } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import {
  generateToken,
  getDummyHash,
  hashPassword,
  hashToken,
  verifyPassword,
} from '@/server/lib/password';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/server/lib/jwt';
import { sendPasswordResetEmail } from '@/server/lib/email';
import {
  addRefreshSession,
  applyPasswordReset,
  createUser,
  existsByPhoneOrEmail,
  findUserById,
  findUserByIdentifier,
  findUserByResetTokenHash,
  findUserWithPassword,
  getRefreshSessions,
  pruneExpiredSessions,
  recordFailedLogin,
  recordSuccessfulLogin,
  removeRefreshSession,
  replaceRefreshSession,
  revokeAllRefreshSessions,
  setPasswordResetToken,
  type UserLean,
} from '@/server/repositories/user.repository';
import { normalizeIdentifier, type RegisterCustomerInput } from '@/shared/schemas/auth.schema';
import { GOVERNORATE } from '@/shared/constants/fayoum-areas';
import type { UserRole } from '@/shared/constants/roles';

/* ------------------------------------------------------------------ */

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * رسالة فشل موحّدة.
 *
 * لا تفرّق بين «حساب غير موجود» و«كلمة مرور خاطئة» — وإلا صارت الاستجابة
 * أداة لتعداد الحسابات (ARCHITECTURE §7).
 */
const INVALID_CREDENTIALS = 'رقم الهاتف أو البريد الإلكتروني أو كلمة المرور غير صحيحة.';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserDto {
  id: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  email?: string;
  status: string;
  area?: string;
  city?: string;
  governorate?: string;
  /** «العنوان التفصيلي» في الصورة 19 — تعرضه شاشة المراجعة (22). */
  addressLine?: string;
  avatarUrl?: string;
}

export function toAuthUserDto(user: UserLean): AuthUserDto {
  return {
    id: String(user._id),
    role: user.role,
    fullName: user.fullName,
    ...(user.phone ? { phone: user.phone } : {}),
    ...(user.email ? { email: user.email } : {}),
    status: user.status,
    ...(user.area ? { area: user.area } : {}),
    ...(user.city ? { city: user.city } : {}),
    ...(user.governorate ? { governorate: user.governorate } : {}),
    ...(user.addressLine ? { addressLine: user.addressLine } : {}),
    ...(user.avatar?.url ? { avatarUrl: user.avatar.url } : {}),
  };
}

/* ================================================================== */
/* التسجيل                                                             */
/* ================================================================== */

export async function registerCustomer(
  input: RegisterCustomerInput,
  meta: { userAgent?: string }
): Promise<{ user: AuthUserDto; tokens: SessionTokens }> {
  const taken = await existsByPhoneOrEmail({ phone: input.phone, email: input.email });

  if (taken.phone) {
    throw conflict('رقم الهاتف مسجّل بالفعل. سجّل الدخول أو استخدم رقمًا آخر.');
  }
  if (taken.email) {
    throw conflict('البريد الإلكتروني مسجّل بالفعل. سجّل الدخول أو استخدم بريدًا آخر.');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await createUser({
    role: 'CUSTOMER',
    fullName: input.fullName,
    phone: input.phone,
    ...(input.email ? { email: input.email } : {}),
    passwordHash,
    status: 'ACTIVE',
    governorate: GOVERNORATE,
    city: input.city,
    area: input.area,
  });

  // `createUser` تعيد null نظريًا فقط — المستند أُنشئ للتو
  if (!user) throw conflict('تعذّر إنشاء الحساب. برجاء المحاولة مرة أخرى.');

  const tokens = await issueSession(user, { userAgent: meta.userAgent, remember: true });
  logger.info('تم إنشاء حساب عميل', { userId: String(user._id) });

  return { user: toAuthUserDto(user), tokens };
}

/* ================================================================== */
/* تسجيل الدخول                                                        */
/* ================================================================== */

export async function login(
  input: { identifier: string; password: string; remember: boolean },
  meta: { userAgent?: string }
): Promise<{ user: AuthUserDto; tokens: SessionTokens }> {
  const identifier = normalizeIdentifier(input.identifier);

  if (!identifier) {
    // معرّف غير صالح الشكل — نستهلك وقتًا مماثلًا ثم نرفض بنفس الرسالة
    await verifyPassword(input.password, await getDummyHash());
    throw unauthorized(INVALID_CREDENTIALS);
  }

  const user = await findUserWithPassword(identifier);

  if (!user) {
    // تحقق وهمي — يمنع تعداد الحسابات بقياس زمن الاستجابة
    await verifyPassword(input.password, await getDummyHash());
    throw unauthorized(INVALID_CREDENTIALS);
  }

  // الحساب مقفل بعد محاولات فاشلة متتالية
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw forbidden(`تم قفل الحساب مؤقتًا بسبب محاولات دخول متكررة. حاول بعد ${minutes} دقيقة.`);
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);

  if (!passwordOk) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

    await recordFailedLogin(String(user._id), {
      attempts,
      ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) } : {}),
    });

    logger.warn('محاولة دخول فاشلة', { userId: String(user._id), attempts, locked: shouldLock });

    if (shouldLock) {
      throw forbidden('تم قفل الحساب مؤقتًا بسبب محاولات دخول متكررة. حاول بعد 15 دقيقة.');
    }
    throw unauthorized(INVALID_CREDENTIALS);
  }

  if (user.status === 'SUSPENDED') {
    throw forbidden('تم إيقاف حسابك. برجاء التواصل مع الدعم.');
  }

  await recordSuccessfulLogin(String(user._id));
  await pruneExpiredSessions(String(user._id));

  const tokens = await issueSession(user, {
    userAgent: meta.userAgent,
    remember: input.remember,
  });

  logger.info('تسجيل دخول ناجح', { userId: String(user._id), role: user.role });
  return { user: toAuthUserDto(user), tokens };
}

/* ================================================================== */
/* تحديث الجلسة — مع الدوران وكشف إعادة الاستخدام                       */
/* ================================================================== */

export async function refreshSession(
  refreshToken: string,
  meta: { userAgent?: string }
): Promise<{ user: AuthUserDto; tokens: SessionTokens }> {
  const claims = await verifyRefreshToken(refreshToken);
  if (!claims) throw unauthorized('انتهت الجلسة. برجاء تسجيل الدخول مرة أخرى.');

  const userId = claims.sub;
  const presentedHash = hashToken(refreshToken);
  const sessions = await getRefreshSessions(userId);
  const match = sessions.find((session) => session.hash === presentedHash);

  /*
   * كشف إعادة الاستخدام:
   * التوقيع صالح لكن التجزئة غير موجودة في القائمة ⇒ التوكن استُخدم من قبل
   * ودُوِّر، أو أُبطل. هذا مؤشر سرقة توكن، فنُبطل **كل** جلسات المستخدم
   * ونجبره على تسجيل دخول جديد (ARCHITECTURE §7).
   */
  if (!match) {
    await revokeAllRefreshSessions(userId);
    logger.warn('كشف إعادة استخدام توكن تحديث — أُبطلت كل الجلسات', { userId });
    throw unauthorized('انتهت الجلسة. برجاء تسجيل الدخول مرة أخرى.');
  }

  if (match.expiresAt <= new Date()) {
    await removeRefreshSession(userId, presentedHash);
    throw unauthorized('انتهت الجلسة. برجاء تسجيل الدخول مرة أخرى.');
  }

  const user = await findUserById(userId);
  if (!user) throw unauthorized('انتهت الجلسة. برجاء تسجيل الدخول مرة أخرى.');
  if (user.status === 'SUSPENDED') {
    await revokeAllRefreshSessions(userId);
    throw forbidden('تم إيقاف حسابك. برجاء التواصل مع الدعم.');
  }

  // الدوران: نصدر توكنًا جديدًا ونستبدل القديم في نفس العملية
  const sessionId = randomUUID();
  const nextRefreshToken = await signRefreshToken({ userId, sessionId });
  const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await replaceRefreshSession(userId, presentedHash, {
    hash: hashToken(nextRefreshToken),
    ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    expiresAt: nextExpiresAt,
  });

  const accessToken = await signAccessToken({
    userId,
    role: user.role,
    status: user.status,
  });

  return {
    user: toAuthUserDto(user),
    tokens: { accessToken, refreshToken: nextRefreshToken },
  };
}

/* ================================================================== */
/* تسجيل الخروج                                                        */
/* ================================================================== */

export async function logout(
  refreshToken: string | null,
  options: { allDevices: boolean }
): Promise<void> {
  if (!refreshToken) return;

  const claims = await verifyRefreshToken(refreshToken);
  if (!claims) return;

  if (options.allDevices) {
    await revokeAllRefreshSessions(claims.sub);
    logger.info('تسجيل خروج من كل الأجهزة', { userId: claims.sub });
    return;
  }

  await removeRefreshSession(claims.sub, hashToken(refreshToken));
  logger.info('تسجيل خروج', { userId: claims.sub });
}

/* ================================================================== */
/* إعادة تعيين كلمة المرور                                             */
/* ================================================================== */

/**
 * يبدأ إعادة التعيين.
 *
 * يعيد نفس النتيجة سواء وُجد البريد أم لا — وإلا صار الرد أداة للتحقق
 * من وجود حساب ببريد معيّن.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findUserByIdentifier({ email });

  if (!user || !user.email) {
    logger.info('طلب إعادة تعيين لبريد غير مسجّل', { email });
    return;
  }

  const token = generateToken(32);
  await setPasswordResetToken(String(user._id), {
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  await sendPasswordResetEmail({
    to: user.email,
    fullName: user.fullName,
    token,
  });

  logger.info('أُرسل طلب إعادة تعيين كلمة المرور', { userId: String(user._id) });
}

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<void> {
  const user = await findUserByResetTokenHash(hashToken(input.token));

  if (!user) {
    throw unauthorized('رابط إعادة التعيين غير صالح أو انتهت صلاحيته.');
  }

  const passwordHash = await hashPassword(input.password);
  // يُبطل التوكن وكل الجلسات معًا
  await applyPasswordReset(String(user._id), passwordHash);

  logger.info('تم تغيير كلمة المرور', { userId: String(user._id) });
}

/* ================================================================== */

export async function getUserById(userId: string): Promise<AuthUserDto | null> {
  const user = await findUserById(userId);
  return user ? toAuthUserDto(user) : null;
}

/** يصدر زوج توكنات ويسجّل جلسة التحديث. */
/**
 * يُصدر جلسة جديدة.
 *
 * مُصدَّرة لأن تسجيل مقدم الخدمة (Phase 6) ينشئ الحساب ويسجّل الدخول في
 * خطوة واحدة — المستندات لا تُرفع بلا جلسة، فلا معنى لمطالبته بالدخول
 * يدويًا بين الخطوتين 2 و3.
 */
export async function issueSession(
  user: UserLean,
  meta: { userAgent?: string | undefined; remember: boolean }
): Promise<SessionTokens> {
  const userId = String(user._id);
  const sessionId = randomUUID();

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ userId, role: user.role, status: user.status }),
    signRefreshToken({ userId, sessionId }),
  ]);

  await addRefreshSession(userId, {
    hash: hashToken(refreshToken),
    ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
  });

  return { accessToken, refreshToken };
}
