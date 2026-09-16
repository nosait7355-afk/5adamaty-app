import { notFound } from '@/server/lib/errors';
import {
  countProviderServices,
  findProviderById,
  findProviderReviews,
  findProviders,
  findPublicProviderContact,
  findServiceById,
  findServices,
  type DiscoveryFilters,
  type Paged,
  type ProviderRow,
  type ReviewRow,
  type ServiceRow,
} from '@/server/repositories/discovery.repository';
import {
  findCategoryBySlug,
  findProfessionBySlug,
} from '@/server/repositories/catalog.repository';
import type { DiscoveryQuery, SearchQuery } from '@/shared/schemas/catalog.schema';

/**
 * خدمات الاكتشاف (Phase 5) — تحوّل صفوف قاعدة البيانات إلى DTOs جاهزة
 * للواجهة، وتترجم الـslugs إلى معرّفات.
 *
 * لا يوجد أي حقل اتصال (هاتف/بريد/واتساب) في أي DTO هنا. التواصل المباشر
 * لا يُفتح إلا بعد قبول الطلب (Phase 7/8)، فالقوائم والملف العام لا تحمله.
 */

/* ================================================================== */
/* أشكال الإخراج                                                       */
/* ================================================================== */

export interface ProviderCardDto {
  id: string;
  displayName: string;
  bio: string;
  categoryId: string;
  categoryName?: string;
  categorySlug?: string;
  professionId: string;
  professionName?: string;
  professionIcon?: string;
  yearsOfExperience?: number;
  /** المنطقة الأولى — هي المعروضة بجانب 📍 في البطاقة. */
  area?: string;
  coverageAreas: string[];
  isVerifiedBadge: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedOrders: number;
  avatar?: string;
}

export interface ProviderDetailDto extends ProviderCardDto {
  gallery: string[];
  customersCount: number;
  avgResponseMinutes?: number;
  memberSince?: string;
  servicesCount: number;
}

export interface ServiceCardDto {
  id: string;
  title: string;
  description: string;
  areas: string[];
  area?: string;
  ratingAvg: number;
  ratingCount: number;
  ordersCount: number;
  image?: string;
  categoryId: string;
  categoryName?: string;
  categorySlug?: string;
  professionId: string;
  professionName?: string;
  professionIcon?: string;
  provider: {
    id: string;
    displayName?: string;
    ratingAvg?: number;
    ratingCount?: number;
    yearsOfExperience?: number;
    isVerifiedBadge?: boolean;
  };
}

export interface ServiceDetailDto extends ServiceCardDto {
  images: string[];
  providerBio?: string;
  providerCompletedOrders?: number;
}

export interface ReviewDto {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  customerName: string;
  customerAvatar?: string;
}

export interface ReviewsResultDto {
  items: ReviewDto[];
  total: number;
  /** عدد التقييمات لكل نجمة — يغذّي مخطط التوزيع في تبويب التقييمات. */
  breakdown: Record<string, number>;
}

export interface SearchResultDto {
  services: ServiceCardDto[];
  providers: ProviderCardDto[];
  totals: { services: number; providers: number };
}

/* ================================================================== */
/* المحوّلات                                                           */
/* ================================================================== */

function toProviderCard(row: ProviderRow): ProviderCardDto {
  return {
    id: String(row._id),
    displayName: row.displayName,
    bio: row.bio,
    categoryId: String(row.categoryId),
    ...(row.categoryName ? { categoryName: row.categoryName } : {}),
    ...(row.categorySlug ? { categorySlug: row.categorySlug } : {}),
    professionId: String(row.professionId),
    ...(row.professionName ? { professionName: row.professionName } : {}),
    ...(row.professionIcon ? { professionIcon: row.professionIcon } : {}),
    ...(row.yearsOfExperience != null ? { yearsOfExperience: row.yearsOfExperience } : {}),
    ...(row.coverageAreas?.[0] ? { area: row.coverageAreas[0] } : {}),
    coverageAreas: row.coverageAreas ?? [],
    isVerifiedBadge: row.isVerifiedBadge,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    completedOrders: row.completedOrders,
    ...(row.avatar ? { avatar: row.avatar } : {}),
  };
}

function toProviderDetail(row: ProviderRow, servicesCount: number): ProviderDetailDto {
  return {
    ...toProviderCard(row),
    gallery: (row.gallery ?? []).map((image) => image.url),
    customersCount: row.customersCount ?? 0,
    ...(row.avgResponseMinutes != null ? { avgResponseMinutes: row.avgResponseMinutes } : {}),
    ...(row.memberSince ? { memberSince: new Date(row.memberSince).toISOString() } : {}),
    servicesCount,
  };
}

function toServiceCard(row: ServiceRow): ServiceCardDto {
  return {
    id: String(row._id),
    title: row.title,
    description: row.description,
    areas: row.areas ?? [],
    ...(row.areas?.[0] ? { area: row.areas[0] } : {}),
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    ordersCount: row.ordersCount,
    ...(row.image ? { image: row.image } : {}),
    categoryId: String(row.categoryId),
    ...(row.categoryName ? { categoryName: row.categoryName } : {}),
    ...(row.categorySlug ? { categorySlug: row.categorySlug } : {}),
    professionId: String(row.professionId),
    ...(row.professionName ? { professionName: row.professionName } : {}),
    ...(row.professionIcon ? { professionIcon: row.professionIcon } : {}),
    provider: {
      id: String(row.providerId),
      ...(row.providerName ? { displayName: row.providerName } : {}),
      ...(row.providerRatingAvg != null ? { ratingAvg: row.providerRatingAvg } : {}),
      ...(row.providerRatingCount != null ? { ratingCount: row.providerRatingCount } : {}),
      ...(row.providerYears != null ? { yearsOfExperience: row.providerYears } : {}),
      ...(row.providerVerified != null ? { isVerifiedBadge: row.providerVerified } : {}),
    },
  };
}

function toServiceDetail(row: ServiceRow): ServiceDetailDto {
  return {
    ...toServiceCard(row),
    images: (row.images ?? []).map((image) => image.url),
    ...(row.providerBio ? { providerBio: row.providerBio } : {}),
    ...(row.providerCompletedOrders != null
      ? { providerCompletedOrders: row.providerCompletedOrders }
      : {}),
  };
}

function toReview(row: ReviewRow): ReviewDto {
  return {
    id: String(row._id),
    rating: row.rating,
    ...(row.comment ? { comment: row.comment } : {}),
    createdAt: new Date(row.createdAt).toISOString(),
    customerName: row.customerName ?? 'عميل',
    ...(row.customerAvatar ? { customerAvatar: row.customerAvatar } : {}),
  };
}

/* ================================================================== */
/* ترجمة الـslugs إلى معرّفات                                          */
/* ================================================================== */

/**
 * يحوّل `categorySlug`/`professionSlug` إلى معرّفات.
 *
 * slug غير موجود يعني نتيجة فارغة لا خطأ 500: نضع معرّفًا مستحيلًا حتى
 * تعيد القائمة صفر عنصر بدل تجاهل الفلتر وإظهار كل شيء.
 */
const IMPOSSIBLE_ID = '000000000000000000000000';

async function resolveFilters(query: DiscoveryQuery): Promise<DiscoveryFilters> {
  let categoryId = query.categoryId;
  let professionId = query.professionId;

  if (!categoryId && query.categorySlug) {
    const category = await findCategoryBySlug(query.categorySlug);
    categoryId = category ? String(category._id) : IMPOSSIBLE_ID;
  }

  if (!professionId && query.professionSlug) {
    const profession = await findProfessionBySlug(query.professionSlug);
    professionId = profession ? String(profession._id) : IMPOSSIBLE_ID;
  }

  return {
    q: query.q,
    categoryId,
    professionId,
    providerId: query.providerId,
    area: query.area,
    minRating: query.minRating,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
  };
}

/* ================================================================== */
/* الخدمات                                                             */
/* ================================================================== */

export interface PagedDto<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function toPagedDto<TRow, TDto>(
  paged: Paged<TRow>,
  page: number,
  limit: number,
  map: (row: TRow) => TDto
): PagedDto<TDto> {
  return {
    items: paged.items.map(map),
    total: paged.total,
    page,
    limit,
    hasMore: page * limit < paged.total,
  };
}

/** قائمة مقدمي الخدمات — الصورة 06 (مميزون) والبحث. */
export async function listProviders(query: DiscoveryQuery): Promise<PagedDto<ProviderCardDto>> {
  const filters = await resolveFilters(query);
  const paged = await findProviders(filters);
  return toPagedDto(paged, query.page, query.limit, toProviderCard);
}

/** ملف مقدم الخدمة — الصورة 10. */
export async function getProvider(id: string): Promise<ProviderDetailDto> {
  const row = await findProviderById(id);
  if (!row) throw notFound('مقدم الخدمة المطلوب غير موجود.');

  const servicesCount = await countProviderServices(id);
  return toProviderDetail(row, servicesCount);
}

export interface ProviderContactDto {
  /** رابط `tel:` جاهز — الواجهة لا تعرض الرقم، تنتقل إليه مباشرة. */
  callUrl?: string;
  /** رابط `wa.me` جاهز. */
  whatsappUrl?: string;
}

/** يحوّل 01XXXXXXXXX أو +201XXXXXXXXX إلى أرقام دولية بلا + (201XXXXXXXXX). */
function toInternationalDigits(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (/^01\d{9}$/.test(digits)) return `20${digits.slice(1)}`;
  if (/^201\d{9}$/.test(digits)) return digits;
  return null;
}

/**
 * روابط التواصل مع مقدم خدمة — زرّا «اتصل الآن» و«واتساب».
 *
 * رقم الواتساب اختياري للحسابات القديمة المسجّلة قبل إضافة الحقل؛ عندها
 * نستخدم رقم الهاتف لأنه غالبًا نفس الرقم.
 */
export async function getProviderContact(id: string): Promise<ProviderContactDto> {
  const contact = await findPublicProviderContact(id);
  if (!contact) throw notFound('مقدم الخدمة المطلوب غير موجود.');

  const phone = contact.phone ? toInternationalDigits(contact.phone) : null;
  const whatsapp = toInternationalDigits(contact.whatsapp ?? contact.phone ?? '');

  return {
    ...(phone ? { callUrl: `tel:+${phone}` } : {}),
    ...(whatsapp ? { whatsappUrl: `https://wa.me/${whatsapp}` } : {}),
  };
}

/** قائمة الخدمات — الصورة 09. */
export async function listServices(query: DiscoveryQuery): Promise<PagedDto<ServiceCardDto>> {
  const filters = await resolveFilters(query);
  const paged = await findServices(filters);
  return toPagedDto(paged, query.page, query.limit, toServiceCard);
}

/** تفاصيل خدمة — تغذّي بطاقة المزوّد في شاشة طلب الخدمة (الصورة 11). */
export async function getService(id: string): Promise<ServiceDetailDto> {
  const row = await findServiceById(id);
  if (!row) throw notFound('الخدمة المطلوبة غير موجودة.');
  return toServiceDetail(row);
}

/** تقييمات مقدم خدمة — تبويب «التقييمات» في الصورة 10. */
export async function listProviderReviews(
  providerId: string,
  pagination: { page: number; limit: number }
): Promise<ReviewsResultDto> {
  // نتحقق أولًا أن المزوّد نفسه ظاهر للعامة — وإلا فلا تقييمات تُعاد
  const provider = await findProviderById(providerId);
  if (!provider) throw notFound('مقدم الخدمة المطلوب غير موجود.');

  const result = await findProviderReviews(providerId, pagination);
  return {
    items: result.items.map(toReview),
    total: result.total,
    breakdown: result.breakdown,
  };
}

/**
 * البحث الموحّد — الشاشة المشتقّة من حقل البحث في الصور 06–09.
 * يبحث في الخدمات والمزوّدين معًا بالفهرس النصي.
 */
export async function search(query: SearchQuery): Promise<SearchResultDto> {
  const wantsServices = query.type === 'all' || query.type === 'services';
  const wantsProviders = query.type === 'all' || query.type === 'providers';

  const run = async (qMode: 'text' | 'prefix') => {
    const base: DiscoveryFilters = {
      q: query.q,
      qMode,
      sort: 'rating',
      page: query.page,
      limit: query.limit,
    };

    const [services, providers] = await Promise.all([
      wantsServices ? findServices(base) : Promise.resolve({ items: [], total: 0 }),
      wantsProviders ? findProviders(base) : Promise.resolve({ items: [], total: 0 }),
    ]);

    return { services, providers };
  };

  let result = await run('text');

  /*
   * خطة ثانية عند صفر نتيجة: الفهرس النصي يطابق الكلمات الكاملة فقط، فبحث
   * «كهرب» لا يجد «كهربائي» — وهو ما يفعله المستخدم بالضبط مع كل حرف يكتبه
   * في حقل البحث. المسح الجزئي أثقل، لذا لا يُشغَّل إلا هنا، ونصّ البحث
   * مهرَّب بالكامل قبل استخدامه كتعبير نمطي.
   */
  if (result.services.total === 0 && result.providers.total === 0) {
    result = await run('prefix');
  }

  return {
    services: result.services.items.map(toServiceCard),
    providers: result.providers.items.map(toProviderCard),
    totals: { services: result.services.total, providers: result.providers.total },
  };
}
