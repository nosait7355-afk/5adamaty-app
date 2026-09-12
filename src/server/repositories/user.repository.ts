import { Types, trusted } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { User, type UserDocument } from '@/server/db/models';

/**
 * الوصول لبيانات المستخدمين.
 *
 * قاعدة: `passwordHash` و`refreshTokens` عليهما `select: false` في الـSchema،
 * فلا يخرجان إلا بطلب صريح `.select('+...')` — وهو محصور في هذه الطبقة.
 */

export type UserLean = Omit<UserDocument, '_id'> & { _id: Types.ObjectId };

export async function findUserById(id: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return User.findById(id).lean<UserLean | null>();
}

/** يبحث بالهاتف أو البريد — أحدهما يُمرَّر. */
export async function findUserByIdentifier(identifier: { phone?: string; email?: string }) {
  await connectToDatabase();

  const filter: Record<string, string> = {};
  if (identifier.phone) filter.phone = identifier.phone;
  else if (identifier.email) filter.email = identifier.email;
  else return null;

  return User.findOne(filter).lean<UserLean | null>();
}

/** يبحث بمعرّف حساب جوجل — لتسجيل الدخول/الربط عبر جوجل. */
export async function findUserByGoogleId(googleId: string) {
  await connectToDatabase();
  return User.findOne({ googleId }).select('+googleId').lean<UserLean | null>();
}

/** يجلب المستخدم مع تجزئة كلمة المرور — للتحقق عند الدخول فقط. */
export async function findUserWithPassword(identifier: { phone?: string; email?: string }) {
  await connectToDatabase();

  const filter: Record<string, string> = {};
  if (identifier.phone) filter.phone = identifier.phone;
  else if (identifier.email) filter.email = identifier.email;
  else return null;

  return User.findOne(filter).select('+passwordHash').lean<UserLean | null>();
}

export async function existsByPhoneOrEmail(params: {
  phone?: string | undefined;
  email?: string | undefined;
}): Promise<{ phone: boolean; email: boolean }> {
  await connectToDatabase();

  const [phoneTaken, emailTaken] = await Promise.all([
    params.phone ? User.exists({ phone: params.phone }) : Promise.resolve(null),
    params.email ? User.exists({ email: params.email }) : Promise.resolve(null),
  ]);

  return { phone: Boolean(phoneTaken), email: Boolean(emailTaken) };
}

/** يربط حساب جوجل بحساب موجود عثر عليه بنفس البريد — لا يُنشئ حسابًا مكررًا. */
export async function linkGoogleId(userId: string, googleId: string): Promise<void> {
  await connectToDatabase();
  await User.updateOne({ _id: new Types.ObjectId(userId) }, { $set: { googleId } });
}

export async function createUser(data: Partial<UserDocument>) {
  await connectToDatabase();
  const created = await User.create(data);
  // نعيد قراءته بالـprojection الافتراضية حتى لا تتسرّب الحقول الحسّاسة
  return User.findById(created._id).lean<UserLean>();
}

/* ---- إدارة جلسات التحديث ---- */

export async function addRefreshSession(
  userId: string,
  session: { hash: string; userAgent?: string; expiresAt: Date }
): Promise<void> {
  await connectToDatabase();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    { $push: { refreshTokens: { ...session, createdAt: new Date() } } }
  );
}

/** يجلب جلسات التحديث — مطلوب للتحقق من الدوران. */
export async function getRefreshSessions(userId: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(userId)) return [];

  const user = await User.findById(userId)
    .select('+refreshTokens')
    .lean<Pick<UserLean, 'refreshTokens'> | null>();

  return user?.refreshTokens ?? [];
}

export async function replaceRefreshSession(
  userId: string,
  oldHash: string,
  next: { hash: string; userAgent?: string; expiresAt: Date }
): Promise<void> {
  await connectToDatabase();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $pull: { refreshTokens: { hash: oldHash } },
    }
  );
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    { $push: { refreshTokens: { ...next, createdAt: new Date() } } }
  );
}

export async function removeRefreshSession(userId: string, hash: string): Promise<void> {
  await connectToDatabase();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    { $pull: { refreshTokens: { hash } } }
  );
}

/** يُبطل كل الجلسات — عند الخروج من كل الأجهزة أو عند كشف إعادة استخدام توكن. */
export async function revokeAllRefreshSessions(userId: string): Promise<void> {
  await connectToDatabase();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    { $set: { refreshTokens: [] } }
  );
}

/** يحذف الجلسات المنتهية — تنظيف دوري رخيص. */
export async function pruneExpiredSessions(userId: string): Promise<void> {
  await connectToDatabase();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    { $pull: { refreshTokens: { expiresAt: { $lt: new Date() } } } }
  );
}

/* ---- محاولات الدخول الفاشلة ---- */

export async function recordFailedLogin(
  userId: string,
  params: { attempts: number; lockedUntil?: Date }
): Promise<void> {
  await connectToDatabase();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $set: {
        failedLoginAttempts: params.attempts,
        ...(params.lockedUntil ? { lockedUntil: params.lockedUntil } : {}),
      },
    }
  );
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await connectToDatabase();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $set: { failedLoginAttempts: 0, lastLoginAt: new Date() },
      $unset: { lockedUntil: '' },
    }
  );
}

/* ---- إعادة تعيين كلمة المرور ---- */

export async function setPasswordResetToken(
  userId: string,
  params: { tokenHash: string; expiresAt: Date }
): Promise<void> {
  await connectToDatabase();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $set: {
        passwordResetTokenHash: params.tokenHash,
        passwordResetExpiresAt: params.expiresAt,
      },
    }
  );
}

export async function findUserByResetTokenHash(tokenHash: string) {
  await connectToDatabase();
  return User.findOne({
    passwordResetTokenHash: tokenHash,
    /*
     * `mongoose.trusted()` ضروري هنا: `sanitizeFilter: true` يجرّد أي مُعامل
     * `$` من المرشّحات باعتباره حقنًا محتملًا — وهو ما نريده للمدخلات القادمة
     * من المستخدم. هذا المُعامل من السيرفر ولا يمسّه أي إدخال، فنعلّمه موثوقًا
     * صراحةً. لا تستخدم `trusted()` مع أي قيمة أصلها من الطلب.
     */
    passwordResetExpiresAt: trusted({ $gt: new Date() }),
  })
    .select('+passwordResetTokenHash +passwordResetExpiresAt')
    .lean<UserLean | null>();
}

/**
 * يغيّر كلمة المرور ويُبطل التوكن وكل الجلسات دفعة واحدة.
 * إبطال الجلسات إجباري: من غيّر كلمة المرور قد يكون يستعيد حسابًا مخترقًا.
 */
export async function applyPasswordReset(
  userId: string,
  passwordHash: string
): Promise<void> {
  await connectToDatabase();
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $set: { passwordHash, refreshTokens: [], failedLoginAttempts: 0 },
      $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '', lockedUntil: '' },
    }
  );
}
