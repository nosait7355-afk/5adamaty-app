import { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { Category, Profession, Review, Service, ServiceProvider, User } from '@/server/db/models';
import type { SortOption } from '@/shared/schemas/catalog.schema';

/**
 * طبقة الوصول لبيانات الاكتشاف (Phase 5).
 *
 * كل الاستعلامات هنا **عامة** (بلا مصادقة)، لذا تحكمها قاعدتان:
 *
 * 1. حارس الظهور: لا يظهر مزوّد في أي قائمة أو بحث أو صفحة تفاصيل ما لم
 *    يكن `verification.status = APPROVED` و`isActive = true`. الحارس مطبَّق
 *    داخل هذه الطبقة لا في الخدمات، فلا يمكن لأي مستدعٍ نسيانه.
 * 2. قائمة سماح صريحة للحقول (`$project`): لا نعتمد على الاستبعاد. مستندات
 *    المزوّد تحمل `verification.requestNumber` و`rejectionReason` و`userId`،
 *    وكلها لا تخرج من هنا أبدًا. ولا نضمّ مجموعة `users` في أي مسار عام
 *    عدا اسم صاحب التقييم — فلا يوجد أصلًا هاتف أو بريد ليتسرّب.
 *
 * ملاحظة على `sanitizeFilter`: خط أنابيب التجميع لا يمرّ بمنقّي Mongoose،
 * لذا كل قيمة تدخل هنا تكون قد اجتازت Zod أولًا (ObjectId، أو رقم، أو قيمة
 * من قائمة مناطق الفيوم الثابتة)، والنص الحر الوحيد (`q`) يُهرَّب قبل أي
 * استخدام كتعبير نمطي.
 */

/* ================================================================== */
/* الحُرّاس والثوابت                                                    */
/* ================================================================== */

/** الحارس على مستوى مستند المزوّد نفسه. */
export const PUBLIC_PROVIDER_MATCH = {
  isActive: true,
  'verification.status': 'APPROVED',
} as const;

/** الحارس نفسه بعد ضمّ المزوّد باسم `provider` في خط أنابيب الخدمات. */
export const PUBLIC_PROVIDER_MATCH_JOINED = {
  'provider.isActive': true,
  'provider.verification.status': 'APPROVED',
} as const;

const PROVIDERS_COLLECTION = ServiceProvider.collection.name;
const CATEGORIES_COLLECTION = Category.collection.name;
const PROFESSIONS_COLLECTION = Profession.collection.name;
const USERS_COLLECTION = User.collection.name;

/* ================================================================== */
/* بناء الاستعلام — دوال خالصة (تُختبر وحدويًا بلا قاعدة بيانات)         */
/* ================================================================== */

export interface DiscoveryFilters {
  q?: string | undefined;
  categoryId?: string | undefined;
  professionId?: string | undefined;
  providerId?: string | undefined;
  area?: string | undefined;
  minRating?: number | undefined;
  sort?: SortOption | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  /**
   * `text`   — الفهرس النصي: سريع، لكنه يطابق **الكلمات الكاملة** فقط.
   * `prefix` — تطابق جزئي بتعبير نمطي، خطة ثانية لا أكثر.
   */
  qMode?: 'text' | 'prefix' | undefined;
}

/**
 * يهرّب كل محارف التعبير النمطي في نص المستخدم.
 *
 * بدون هذا يصير حقل البحث ثغرة: نص يحوي مُكمّمات متداخلة يُنفَّذ كنمط
 * ويستهلك المعالج (ReDoS)، ونمط «أي شيء» يعطّل الفلترة. بعد الهروب يصبح
 * النص حرفيًا بالكامل، فلا يبقى فيه أي مُكمّم يتحكّم فيه المستخدم.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type SortSpec = Record<string, 1 | -1>;

const PROVIDER_SORTS: Record<SortOption, SortSpec> = {
  rating: { ratingAvg: -1, ratingCount: -1 },
  newest: { createdAt: -1 },
};

const SERVICE_SORTS: Record<SortOption, SortSpec> = {
  rating: { ratingAvg: -1, ratingCount: -1 },
  newest: { createdAt: -1 },
};

/**
 * الترتيب مع فاصل تعادل `_id` — بدونه قد يتكرّر عنصر أو يُفقد بين صفحتين
 * عندما تتساوى قيم مفتاح الترتيب (كل مزوّدي التقييم 4.8 مثلًا).
 */
export function buildSort(sort: SortOption = 'rating', kind: 'provider' | 'service'): SortSpec {
  const map = kind === 'provider' ? PROVIDER_SORTS : SERVICE_SORTS;
  return { ...map[sort], _id: -1 };
}

/**
 * يضيف شرط البحث حسب الوضع المطلوب.
 *
 * الوضع الافتراضي هو الفهرس النصي. الوضع الجزئي يمسح المجموعة، فلا يُستدعى
 * إلا بعد أن يعود الفهرس النصي بلا نتائج — وهي حالة شائعة في العربية لأن
 * الفهرس النصي لا يطابق البادئات: «كهرب» لا تجد «كهربائي».
 */
function applySearch(
  match: Record<string, unknown>,
  filters: DiscoveryFilters,
  fields: string[]
): void {
  if (!filters.q) return;

  if (filters.qMode === 'prefix') {
    const pattern = escapeRegex(filters.q);
    match.$or = fields.map((field) => ({ [field]: { $regex: pattern, $options: 'i' } }));
    return;
  }

  match.$text = { $search: filters.q };
}

/** فلتر المزوّدين — يبدأ دائمًا من حارس الظهور. */
export function buildProviderMatch(filters: DiscoveryFilters): Record<string, unknown> {
  const match: Record<string, unknown> = { ...PUBLIC_PROVIDER_MATCH };

  if (filters.categoryId) match.categoryId = new Types.ObjectId(filters.categoryId);
  if (filters.professionId) match.professionId = new Types.ObjectId(filters.professionId);
  // منطقة نصية من قائمة الفيوم الثابتة — لا نصف قطر ولا إحداثيات
  if (filters.area) match.coverageAreas = filters.area;
  if (filters.minRating != null) match.ratingAvg = { $gte: filters.minRating };

  applySearch(match, filters, ['displayName', 'bio']);

  return match;
}

/** فلتر الخدمات — الحارس هنا يُطبَّق على المزوّد المضموم بعد `$lookup`. */
export function buildServiceMatch(filters: DiscoveryFilters): Record<string, unknown> {
  const match: Record<string, unknown> = { isActive: true };

  if (filters.categoryId) match.categoryId = new Types.ObjectId(filters.categoryId);
  if (filters.professionId) match.professionId = new Types.ObjectId(filters.professionId);
  if (filters.providerId) match.providerId = new Types.ObjectId(filters.providerId);
  if (filters.area) match.areas = filters.area;
  if (filters.minRating != null) match.ratingAvg = { $gte: filters.minRating };

  applySearch(match, filters, ['title', 'description']);

  return match;
}

/** يحوّل الصفحة والحد إلى تخطٍّ آمن. */
export function buildPagination(filters: DiscoveryFilters): { skip: number; limit: number } {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  return { skip: (page - 1) * limit, limit };
}

/* ================================================================== */
/* قوائم الحقول المسموح بخروجها                                         */
/* ================================================================== */

const PROVIDER_CARD_PROJECT = {
  _id: 1,
  displayName: 1,
  accountType: 1,
  categoryId: 1,
  professionId: 1,
  yearsOfExperience: 1,
  bio: 1,
  coverageAreas: 1,
  isVerifiedBadge: 1,
  ratingAvg: 1,
  ratingCount: 1,
  completedOrders: 1,
  avatar: { $first: '$gallery.url' },
  categoryName: { $first: '$category.name' },
  categorySlug: { $first: '$category.slug' },
  professionName: { $first: '$profession.name' },
  professionSlug: { $first: '$profession.slug' },
  professionIcon: { $first: '$profession.icon' },
} as const;

const PROVIDER_DETAIL_PROJECT = {
  ...PROVIDER_CARD_PROJECT,
  gallery: 1,
  customersCount: 1,
  avgResponseMinutes: 1,
  memberSince: 1,
  createdAt: 1,
} as const;

const SERVICE_CARD_PROJECT = {
  _id: 1,
  providerId: 1,
  categoryId: 1,
  professionId: 1,
  title: 1,
  description: 1,
  areas: 1,
  ordersCount: 1,
  ratingAvg: 1,
  ratingCount: 1,
  createdAt: 1,
  image: { $first: '$images.url' },
  categoryName: { $first: '$category.name' },
  categorySlug: { $first: '$category.slug' },
  professionName: { $first: '$profession.name' },
  professionIcon: { $first: '$profession.icon' },
  providerName: '$provider.displayName',
  providerRatingAvg: '$provider.ratingAvg',
  providerRatingCount: '$provider.ratingCount',
  providerYears: '$provider.yearsOfExperience',
  providerVerified: '$provider.isVerifiedBadge',
  providerAreas: '$provider.coverageAreas',
} as const;

const SERVICE_DETAIL_PROJECT = {
  ...SERVICE_CARD_PROJECT,
  images: 1,
  providerBio: '$provider.bio',
  providerCompletedOrders: '$provider.completedOrders',
} as const;

/* ================================================================== */
/* أنواع الإخراج الخام                                                  */
/* ================================================================== */

export interface ProviderRow {
  _id: Types.ObjectId;
  displayName: string;
  accountType: string;
  categoryId: Types.ObjectId;
  professionId: Types.ObjectId;
  yearsOfExperience: number;
  bio: string;
  coverageAreas: string[];
  isVerifiedBadge: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedOrders: number;
  customersCount?: number;
  avgResponseMinutes?: number;
  memberSince?: Date;
  createdAt?: Date;
  avatar?: string;
  gallery?: { url: string; publicId: string }[];
  categoryName?: string;
  categorySlug?: string;
  professionName?: string;
  professionSlug?: string;
  professionIcon?: string;
}

export interface ServiceRow {
  _id: Types.ObjectId;
  providerId: Types.ObjectId;
  categoryId: Types.ObjectId;
  professionId: Types.ObjectId;
  title: string;
  description: string;
  areas: string[];
  ordersCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  image?: string;
  images?: { url: string; publicId: string }[];
  categoryName?: string;
  categorySlug?: string;
  professionName?: string;
  professionIcon?: string;
  providerName?: string;
  providerBio?: string;
  providerRatingAvg?: number;
  providerRatingCount?: number;
  providerYears?: number;
  providerVerified?: boolean;
  providerCompletedOrders?: number;
  providerAreas?: string[];
}

export interface ReviewRow {
  _id: Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
  customerName?: string;
  customerAvatar?: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

/** يفكّ ناتج `$facet` الموحّد. */
function unwrapFacet<T>(result: { items?: T[]; total?: { value: number }[] }[]): Paged<T> {
  const first = result[0];
  return {
    items: first?.items ?? [],
    total: first?.total?.[0]?.value ?? 0,
  };
}

const LOOKUP_CATEGORY = {
  $lookup: {
    from: CATEGORIES_COLLECTION,
    localField: 'categoryId',
    foreignField: '_id',
    as: 'category',
  },
};

const LOOKUP_PROFESSION = {
  $lookup: {
    from: PROFESSIONS_COLLECTION,
    localField: 'professionId',
    foreignField: '_id',
    as: 'profession',
  },
};

/* ================================================================== */
/* الاستعلامات                                                          */
/* ================================================================== */

/** قائمة مقدمي الخدمات المعتمدين مع الفلاتر والترتيب والصفحات. */
export async function findProviders(filters: DiscoveryFilters): Promise<Paged<ProviderRow>> {
  await connectToDatabase();
  const { skip, limit } = buildPagination(filters);

  const result = await ServiceProvider.aggregate<{
    items?: ProviderRow[];
    total?: { value: number }[];
  }>([
    { $match: buildProviderMatch(filters) },
    {
      $facet: {
        items: [
          { $sort: buildSort(filters.sort, 'provider') },
          { $skip: skip },
          { $limit: limit },
          LOOKUP_CATEGORY,
          LOOKUP_PROFESSION,
          { $project: PROVIDER_CARD_PROJECT },
        ],
        total: [{ $count: 'value' }],
      },
    },
  ]);

  return unwrapFacet(result);
}

/** مزوّد واحد بالتفصيل — يعيد null للمزوّد غير المعتمد (فيصبح 404). */
export async function findProviderById(id: string): Promise<ProviderRow | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;

  const [row] = await ServiceProvider.aggregate<ProviderRow>([
    { $match: { _id: new Types.ObjectId(id), ...PUBLIC_PROVIDER_MATCH } },
    { $limit: 1 },
    LOOKUP_CATEGORY,
    LOOKUP_PROFESSION,
    { $project: PROVIDER_DETAIL_PROJECT },
  ]);

  return row ?? null;
}

/** قائمة الخدمات — الحارس مطبَّق على المزوّد المالك للخدمة. */
export async function findServices(filters: DiscoveryFilters): Promise<Paged<ServiceRow>> {
  await connectToDatabase();
  const { skip, limit } = buildPagination(filters);

  const result = await Service.aggregate<{ items?: ServiceRow[]; total?: { value: number }[] }>([
    { $match: buildServiceMatch(filters) },
    {
      $lookup: {
        from: PROVIDERS_COLLECTION,
        localField: 'providerId',
        foreignField: '_id',
        as: 'provider',
      },
    },
    { $unwind: '$provider' },
    { $match: { ...PUBLIC_PROVIDER_MATCH_JOINED } },
    {
      $facet: {
        items: [
          { $sort: buildSort(filters.sort, 'service') },
          { $skip: skip },
          { $limit: limit },
          LOOKUP_CATEGORY,
          LOOKUP_PROFESSION,
          { $project: SERVICE_CARD_PROJECT },
        ],
        total: [{ $count: 'value' }],
      },
    },
  ]);

  return unwrapFacet(result);
}

/** خدمة واحدة بالتفصيل. */
export async function findServiceById(id: string): Promise<ServiceRow | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;

  const [row] = await Service.aggregate<ServiceRow>([
    { $match: { _id: new Types.ObjectId(id), isActive: true } },
    { $limit: 1 },
    {
      $lookup: {
        from: PROVIDERS_COLLECTION,
        localField: 'providerId',
        foreignField: '_id',
        as: 'provider',
      },
    },
    { $unwind: '$provider' },
    { $match: { ...PUBLIC_PROVIDER_MATCH_JOINED } },
    LOOKUP_CATEGORY,
    LOOKUP_PROFESSION,
    { $project: SERVICE_DETAIL_PROJECT },
  ]);

  return row ?? null;
}

/** تقييمات مزوّد — المخفية إداريًا (`isVisible = false`) لا تُعاد. */
export async function findProviderReviews(
  providerId: string,
  filters: DiscoveryFilters
): Promise<Paged<ReviewRow> & { breakdown: Record<string, number> }> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(providerId)) return { items: [], total: 0, breakdown: {} };

  const { skip, limit } = buildPagination(filters);

  const result = await Review.aggregate<{
    items?: ReviewRow[];
    total?: { value: number }[];
    breakdown?: { _id: number; count: number }[];
  }>([
    { $match: { providerId: new Types.ObjectId(providerId), isVisible: true } },
    {
      $facet: {
        items: [
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: USERS_COLLECTION,
              localField: 'customerId',
              foreignField: '_id',
              as: 'customer',
            },
          },
          {
            // اسم صاحب التقييم وصورته فقط — لا هاتف ولا بريد
            $project: {
              _id: 1,
              rating: 1,
              comment: 1,
              createdAt: 1,
              customerName: { $first: '$customer.fullName' },
              customerAvatar: { $first: '$customer.avatar.url' },
            },
          },
        ],
        total: [{ $count: 'value' }],
        breakdown: [{ $group: { _id: '$rating', count: { $sum: 1 } } }],
      },
    },
  ]);

  const first = result[0];
  const breakdown: Record<string, number> = {};
  for (const bucket of first?.breakdown ?? []) {
    breakdown[String(bucket._id)] = bucket.count;
  }

  return { items: first?.items ?? [], total: first?.total?.[0]?.value ?? 0, breakdown };
}

/** عدد خدمات مزوّد معتمد — يظهر في تبويب «الخدمات» بالصورة 10. */
export async function countProviderServices(providerId: string): Promise<number> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(providerId)) return 0;
  return Service.countDocuments({ providerId: new Types.ObjectId(providerId), isActive: true });
}
