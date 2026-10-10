import { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { Banner, type BannerDocument } from '@/server/db/models';
import { notFound, unprocessable } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import { deleteAsset } from '@/server/lib/cloudinary';
import { writeAuditLog } from '@/server/repositories/provider.repository';
import { verifyAndBuildMediaRef } from './upload.service';
import {
  DEFAULT_BANNERS,
  MAX_BANNERS,
  type BannerArt,
  type BannerTone,
} from '@/shared/constants/banners';
import type { CreateBannerInput, UpdateBannerInput } from '@/shared/schemas/banner.schema';

/**
 * بانرات الرئيسية — تديرها الإدارة من لوحة التحكم.
 */

type BannerLean = BannerDocument;

interface AdminActor {
  id: string;
  ip?: string;
  userAgent?: string;
}

/* ---- أشكال الإخراج ---- */

/** ما تعرضه الرئيسية — مصدر الصورة محسوم هنا (مرفوعة ← رسمة ← لا شيء). */
export interface PublicBannerDto {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  tone: BannerTone;
  image?: string;
}

export interface AdminBannerDto extends PublicBannerDto {
  art: BannerArt | null;
  /** صورة مرفوعة (لا الرسمة) — يفرّق «إزالة الصورة» عن «تغيير الرسمة». */
  uploadedImage?: string;
  order: number;
  isActive: boolean;
}

function imageOf(banner: BannerLean): string | undefined {
  if (banner.image?.url) return banner.image.url;
  return banner.art ? `/banners/${banner.art}.svg` : undefined;
}

function toPublicDto(banner: BannerLean): PublicBannerDto {
  const image = imageOf(banner);
  return {
    id: String(banner._id),
    title: banner.title,
    description: banner.description,
    ctaLabel: banner.ctaLabel,
    href: banner.href,
    tone: banner.tone,
    ...(image ? { image } : {}),
  };
}

function toAdminDto(banner: BannerLean): AdminBannerDto {
  return {
    ...toPublicDto(banner),
    art: banner.art ?? null,
    ...(banner.image?.url ? { uploadedImage: banner.image.url } : {}),
    order: banner.order,
    isActive: banner.isActive,
  };
}

/* ---- الافتراضيات ---- */

/**
 * ينشئ البانرين الأصليين إن كانت المجموعة خالية تمامًا — قاعدة الإنتاج لا
 * تُبذر، فهذا ما يجعل الرئيسية تعرض بانرات من أول نشر بلا خطوة يدوية.
 *
 * يعمل مرة واحدة عمليًا: بعدها توجد مستندات (حتى لو عطّلتها الإدارة أو
 * حذفتها كلها عمدًا… انظر الشرط). `upsert` على `key` الفريد يمنع التكرار
 * إن وصل طلبان في اللحظة نفسها.
 */
async function ensureDefaultBanners(): Promise<void> {
  if ((await Banner.estimatedDocumentCount()) > 0) return;

  await Promise.all(
    DEFAULT_BANNERS.map((banner) =>
      Banner.updateOne(
        { key: banner.key },
        { $setOnInsert: { ...banner, isActive: true } },
        { upsert: true }
      )
    )
  );
}

const SORT = { order: 1, createdAt: 1 } as const;

/* ---- القراءة ---- */

export async function listPublicBanners(): Promise<PublicBannerDto[]> {
  await connectToDatabase();
  await ensureDefaultBanners();
  const items = await Banner.find({ isActive: true }).sort(SORT).lean<BannerLean[]>();
  return items.map(toPublicDto);
}

export async function listBannersForAdmin(): Promise<AdminBannerDto[]> {
  await connectToDatabase();
  await ensureDefaultBanners();
  const items = await Banner.find({}).sort(SORT).lean<BannerLean[]>();
  return items.map(toAdminDto);
}

/* ---- الكتابة ---- */

async function audit(actor: AdminActor, bannerId: string, before: unknown, after: unknown) {
  await writeAuditLog({
    actorId: actor.id,
    action: 'BANNER_CHANGED',
    entityType: 'Banner',
    entityId: bannerId,
    before,
    after,
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });
}

export async function createBanner(
  actor: AdminActor,
  input: CreateBannerInput
): Promise<AdminBannerDto> {
  await connectToDatabase();
  if ((await Banner.countDocuments()) >= MAX_BANNERS) {
    throw unprocessable(`الحد الأقصى ${MAX_BANNERS} بانرات. احذف بانرًا قديمًا أولًا.`);
  }

  const created = await Banner.create({ ...input, isActive: true });
  await audit(actor, String(created._id), null, { title: input.title, href: input.href });
  logger.info('أُنشئ بانر من الإدارة', { adminId: actor.id, bannerId: String(created._id) });

  return toAdminDto(created.toObject() as BannerLean);
}

export async function updateBanner(
  actor: AdminActor,
  bannerId: string,
  input: UpdateBannerInput
): Promise<AdminBannerDto> {
  await connectToDatabase();
  const existing = await Banner.findById(bannerId).lean<BannerLean | null>();
  if (!existing) throw notFound('البانر غير موجود.');

  const { imagePublicId, ...fields } = input;
  const patch: Record<string, unknown> = { ...fields };

  // البيانات من Cloudinary نفسها، والملف في مجلد هذا المدير (verifyAndBuildMediaRef)
  if (imagePublicId !== undefined) {
    patch.image =
      imagePublicId === null
        ? null
        : await verifyAndBuildMediaRef({
            user: { id: actor.id, role: 'ADMIN', status: 'ACTIVE' },
            purpose: 'BANNER_IMAGE',
            publicId: imagePublicId,
          });
  }

  const updated = await Banner.findByIdAndUpdate(
    bannerId,
    { $set: patch },
    { returnDocument: 'after', runValidators: true }
  ).lean<BannerLean | null>();
  if (!updated) throw notFound('البانر غير موجود.');

  // الصورة القديمة بلا مرجع بعد الاستبدال أو الإزالة — تُحذف بعد نجاح الحفظ فقط
  const previous = existing.image?.publicId;
  if (imagePublicId !== undefined && previous && previous !== imagePublicId) {
    void deleteAsset({ publicId: previous }).catch(() => undefined);
  }

  await audit(
    actor,
    bannerId,
    { title: existing.title, isActive: existing.isActive, href: existing.href },
    { title: updated.title, isActive: updated.isActive, href: updated.href }
  );

  return toAdminDto(updated);
}

/** الحذف نهائي — مع صورته على Cloudinary كي لا تبقى أصول يتيمة. */
export async function deleteBanner(actor: AdminActor, bannerId: string): Promise<void> {
  await connectToDatabase();
  const existing = await Banner.findOneAndDelete({ _id: new Types.ObjectId(bannerId) }).lean<
    BannerLean | null
  >();
  if (!existing) throw notFound('البانر غير موجود.');

  if (existing.image?.publicId) {
    void deleteAsset({ publicId: existing.image.publicId }).catch(() => undefined);
  }

  await audit(actor, bannerId, { title: existing.title }, null);
  logger.info('حُذف بانر من الإدارة', { adminId: actor.id, bannerId });
}
