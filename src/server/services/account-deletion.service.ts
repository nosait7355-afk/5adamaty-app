import mongoose, { Types } from 'mongoose';
import { forbidden, notFound, unprocessable } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import { verifyPassword } from '@/server/lib/password';
import { deleteAsset, isCloudinaryConfigured } from '@/server/lib/cloudinary';
import { connectToDatabase } from '@/server/db/mongoose';
import {
  Address,
  Favorite,
  Message,
  Notification,
  ProviderDocument,
  Review,
  Service,
  ServiceProvider,
  ServiceRequest,
  Thread,
  User,
} from '@/server/db/models';
import { refreshProviderRating } from '@/server/repositories/account.repository';
import { writeAuditLog } from '@/server/repositories/provider.repository';
import type { MediaRef } from '@/server/db/models/shared';
import type { DeleteAccountInput } from '@/shared/schemas/account.schema';
import type { SessionUser } from '@/server/middleware/with-auth';

/**
 * حذف الحساب نهائيًا — مطلب Google Play لأي تطبيق فيه تسجيل حساب.
 *
 * يتطلب كلمة المرور حتى لو كانت الجلسة مفتوحة: جهاز متروك مفتوحًا لا يكفي
 * لحذف حساب صاحبه. حسابات جوجل بلا كلمة مرور تؤكّد بكتابة بريدها بدلًا منها.
 *
 * ما يُحذف: المستخدم وعناوينه ومفضّلته وإشعاراته وتقييماته، وإن كان مقدّم
 * خدمة: ملفه وخدماته ومستنداته وتقييماته وكل مفضّلة تشير إليه. الطلبات
 * والمحادثات القديمة المرتبطة به تُحذف كذلك. الملفات على Cloudinary تُحذف
 * بأفضل جهد — فشل حذف ملف لا يُبقي الحساب.
 *
 * سجل التدقيق يحتفظ بمعرّف الحساب ودوره فقط، بلا أي بيانات شخصية.
 */
export async function deleteMyAccount(
  session: SessionUser,
  input: DeleteAccountInput,
  meta: { ip?: string; userAgent?: string }
): Promise<{ deleted: true }> {
  await connectToDatabase();

  const user = await User.findById(session.id).select('+passwordHash email role avatar');
  if (!user) throw notFound('الحساب غير موجود.');

  // حذف حساب الإدارة من داخل التطبيق يُفقد المنصة من يديرها
  if (user.role === 'ADMIN') {
    throw forbidden('لا يمكن حذف حساب الإدارة من التطبيق.');
  }

  await assertConfirmed(user, input);

  const userId = user._id as Types.ObjectId;
  const media: { ref: MediaRef; authenticated: boolean }[] = [];
  if (user.avatar?.publicId) media.push({ ref: user.avatar, authenticated: false });

  /* ---- ملف مقدم الخدمة وكل ما يتبعه ---- */
  const provider = await ServiceProvider.findOne({ userId }).lean();
  if (provider) {
    const providerId = provider._id;

    for (const image of provider.gallery ?? []) media.push({ ref: image, authenticated: false });

    const services = await Service.find({ providerId }, '_id images').lean();
    for (const service of services) {
      for (const image of service.images ?? []) media.push({ ref: image, authenticated: false });
    }

    const documents = await ProviderDocument.find({ providerId }, 'media').lean();
    for (const document of documents) media.push({ ref: document.media, authenticated: true });

    const serviceIds = services.map((service) => service._id);
    await Promise.all([
      // trusted(): المنقّي العام (sanitizeFilter) يجرّد `$in` من المرشّحات
      Favorite.deleteMany({ $or: [{ providerId }, { serviceId: mongoose.trusted({ $in: serviceIds }) }] }),
      Review.deleteMany({ providerId }),
      Service.deleteMany({ providerId }),
      ProviderDocument.deleteMany({ providerId }),
      ServiceRequest.deleteMany({ providerId }),
    ]);
    await ServiceProvider.deleteOne({ _id: providerId });
  }

  /* ---- تقييمات كتبها كعميل: نحذفها ونعيد حساب متوسط كل مزوّد تأثّر ---- */
  const authoredReviews = await Review.find({ customerId: userId }, 'providerId').lean();
  const affectedProviders = [...new Set(authoredReviews.map((review) => String(review.providerId)))];
  await Review.deleteMany({ customerId: userId });
  for (const providerId of affectedProviders) await refreshProviderRating(providerId);

  /* ---- بيانات المستخدم نفسه ---- */
  const threads = await Thread.find({ participants: userId }, '_id').lean();
  const threadIds = threads.map((thread) => thread._id);
  await Promise.all([
    Address.deleteMany({ userId }),
    Favorite.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    ServiceRequest.deleteMany({ customerId: userId }),
    Message.deleteMany({ threadId: mongoose.trusted({ $in: threadIds }) }),
    Thread.deleteMany({ _id: mongoose.trusted({ $in: threadIds }) }),
  ]);
  await User.deleteOne({ _id: userId });

  await writeAuditLog({
    actorId: String(userId),
    action: 'ACCOUNT_DELETED',
    entityType: 'User',
    entityId: String(userId),
    before: { role: user.role, hadProviderProfile: Boolean(provider) },
    ...(meta.ip ? { ip: meta.ip } : {}),
    ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
  });

  logger.info('حُذف حساب بطلب صاحبه', { userId: String(userId), role: user.role });

  // الملفات بعد قاعدة البيانات: الحساب محذوف حتى لو تعذّر حذف ملف
  await deleteMediaBestEffort(media);

  return { deleted: true };
}

async function assertConfirmed(
  user: { passwordHash?: string | null; email?: string | null },
  input: DeleteAccountInput
): Promise<void> {
  if (user.passwordHash) {
    const valid = input.password ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!valid) throw unprocessable('كلمة المرور غير صحيحة.');
    return;
  }

  // حساب جوجل بلا كلمة مرور: التأكيد بكتابة البريد المسجّل
  const typed = input.confirmEmail?.trim().toLowerCase();
  if (!user.email || typed !== user.email.toLowerCase()) {
    throw unprocessable('حسابك مسجّل بجوجل — اكتب بريدك الإلكتروني المسجّل لتأكيد الحذف.');
  }
}

async function deleteMediaBestEffort(
  media: { ref: MediaRef; authenticated: boolean }[]
): Promise<void> {
  if (media.length === 0 || !isCloudinaryConfigured()) return;

  const results = await Promise.allSettled(
    media.map(({ ref, authenticated }) =>
      deleteAsset({
        publicId: ref.publicId,
        resourceType: ref.resourceType,
        type: authenticated ? 'authenticated' : 'upload',
      })
    )
  );
  const failed = results.filter((result) => result.status === 'rejected' || !result.value).length;
  if (failed > 0) logger.warn('تعذّر حذف بعض ملفات الحساب المحذوف', { failed, total: media.length });
}
