'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  ChevronLeft,
  Gavel,
  Heart,
  ImageIcon,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Star,
} from 'lucide-react';
import { ProfileTopBar, TopBarButton } from '@/components/features/discovery/profile-top-bar';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer } from '@/components/layout/page-container';
import { Chip } from '@/components/ui/badge';
import { Button, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { CatalogIcon } from '@/components/common/catalog-icon';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { ProfileTabs } from '@/components/features/discovery/profile-tabs';
import { ReportProvider } from '@/components/features/discovery/report-provider';
import { Rating } from '@/components/features/discovery/rating-stars';
import { ServiceCard } from '@/components/features/discovery/service-card';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatNumber, formatRating, formatRelativeTime } from '@/lib/format';
import { useProvider, useProviderReviews, useServices } from '@/lib/queries/discovery';
import { useMe } from '@/lib/queries/auth';
import { useFavorites, useToggleFavorite } from '@/lib/queries/account';
import { toast } from '@/lib/toast';
import { useMyProviderProfile } from '@/lib/queries/provider';
import { api, ApiClientError } from '@/lib/api-client';
import type { ProviderContactDto } from '@/server/services/discovery.service';

/**
 * ملف مقدم الخدمة — الصورة 10.
 *
 * التطبيق دليل اتصال مباشر: زرّا «اتصل الآن» و«واتساب» يفتحان الاتصال
 * فورًا. الرقم **لا يُعرض نصًّا** ولا يأتي مع بيانات الصفحة؛ يُطلب من مسار
 * يتطلب تسجيل الدخول لحظة الضغط، ثم ننتقل إلى رابط `tel:` أو `wa.me`.
 */
export default function ProviderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState('about');

  const provider = useProvider(id);
  const services = useServices({ providerId: id, limit: 20 }, Boolean(provider.data));
  const reviews = useProviderReviews(id, Boolean(provider.data));
  const me = useMe();
  /*
   * مقدم الخدمة يتصفّح ملفات مقدمي خدمة آخرين من نفس هذه الشاشة (تبويب
   * "الرئيسية" صار مشتركًا). لو فتح ملفه هو بنفسه، زرّا التواصل لا معنى
   * لهما — يستبدلان برسالة + رابط لتعديل ملفه.
   */
  const myProfile = useMyProviderProfile(me.data?.role === 'PROVIDER');
  const isOwnProfile = Boolean(myProfile.data && myProfile.data.id === id);
  const [contactPending, setContactPending] = useState<'call' | 'whatsapp' | null>(null);
  const [contactError, setContactError] = useState('');

  const openContact = async (channel: 'call' | 'whatsapp') => {
    setContactError('');
    setContactPending(channel);
    try {
      const { data: links } = await api.get<ProviderContactDto>(`/providers/${id}/contact`);
      const url = channel === 'call' ? links.callUrl : links.whatsappUrl;
      if (!url) {
        setContactError(
          channel === 'call' ? 'لا يتوفر رقم هاتف لمقدم الخدمة.' : 'لا يتوفر رقم واتساب لمقدم الخدمة.'
        );
        return;
      }
      if (channel === 'call') window.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setContactError(
        error instanceof ApiClientError ? error.message : 'تعذّر فتح التواصل. حاول مرة أخرى.'
      );
    } finally {
      setContactPending(null);
    }
  };

  /* ---- المفضلة والمشاركة ---- */
  const router = useRouter();
  const favorites = useFavorites(Boolean(me.data));
  const toggleFavorite = useToggleFavorite();
  const isFavorite = favorites.data?.providers.some((item) => item.id === id) ?? false;

  /** متفائل: القلب يمتلئ لحظة الضغط، ويعود كما كان إن فشل الطلب. */
  const onFavorite = () => {
    if (me.isPending) return;
    if (!me.data) {
      toast.info('سجّل الدخول لحفظ مقدم الخدمة في المفضلة', {
        action: {
          label: 'دخول',
          onClick: () => router.push(`/login?next=${encodeURIComponent(`/providers/${id}`)}`),
        },
      });
      return;
    }
    // قبل وصول القائمة لا نعرف حالة القلب — التبديل الآن قد يعكس النيّة
    if (favorites.isPending) return;

    const data = provider.data;
    toggleFavorite.mutate(
      {
        providerId: id,
        ...(data && {
          preview: {
            id,
            displayName: data.displayName,
            professionName: data.professionName,
            ratingAvg: data.ratingAvg,
            ratingCount: data.ratingCount,
            area: data.area,
          },
        }),
      },
      { onError: () => toast.error('تعذّر تحديث المفضلة. حاول مرة أخرى.') }
    );
    toast.success(isFavorite ? 'أُزيل من المفضلة' : 'أُضيف إلى المفضلة');
  };

  /**
   * قائمة المشاركة الأصلية حيث يدعمها المتصفح (كروم أندرويد، سفاري)، وإلا
   * نسخ الرابط. WebView أندرويد لا يدعم Web Share — مشاركة أصلية هناك
   * تحتاج إضافة Capacitor (المرحلة 5).
   */
  const onShare = async () => {
    const data = provider.data;
    const url = `${window.location.origin}/providers/${id}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: data?.displayName,
          text: data ? `${data.displayName} على خدماتي الفيوم` : undefined,
          url,
        });
      } catch {
        // إلغاء المستخدم للقائمة يصل هنا كخطأ — ليس فشلًا يستحق رسالة
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('نُسخ رابط الملف');
    } catch {
      toast.error('تعذّر نسخ الرابط');
    }
  };

  const serviceItems = services.data?.pages.flatMap((page) => page.data) ?? [];
  const reviewItems = reviews.data?.data.items ?? [];
  const reviewsTotal = reviews.data?.meta?.total ?? 0;

  if (provider.isPending) return <ProfileSkeleton />;

  if (provider.isError) {
    return (
      <>
        <BackHeader />
        <PageContainer className="pt-6">
          <ErrorState
            message="تعذّر عرض ملف مقدم الخدمة"
            description="ربما لم يعد متاحًا، أو حدث خطأ في الاتصال."
            onRetry={() => void provider.refetch()}
          />
          <LinkButton href="/categories" variant="secondary" fullWidth className="mt-4">
            تصفّح التصنيفات
          </LinkButton>
        </PageContainer>
      </>
    );
  }

  const data = provider.data;
  // ضعف العرض المعروض تقريبًا — شاشات الهواتف كثيفة البكسل
  const heroImage = cloudinaryUrl(data.gallery[0], { width: 800, height: 520 });
  const reviewsCount = Math.max(reviewsTotal, data.ratingCount);

  return (
    <>
      <ProfileTopBar
        title={data.displayName}
        actions={
          <>
            <TopBarButton label="مشاركة الملف" onClick={() => void onShare()}>
              <Share2 size={18} />
            </TopBarButton>
            {!isOwnProfile && (
              <TopBarButton
                label={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                pressed={isFavorite}
                onClick={onFavorite}
              >
                <Heart size={18} className={isFavorite ? 'fill-danger text-danger' : undefined} />
              </TopBarButton>
            )}
          </>
        }
      />

      {/* ---- صورة الغلاف — بعرض الشاشة وتحت شريط الحالة ---- */}
      <div className="relative mx-auto h-[calc(15rem+env(safe-area-inset-top,0px))] max-w-[520px] overflow-hidden bg-brand-600">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={`من أعمال ${data.displayName}`}
            fill
            sizes="(max-width: 520px) 100vw, 520px"
            priority
            className="object-cover"
          />
        ) : (
          // بلا صور أعمال: أيقونة المهنة على لون العلامة بدل مربع فارغ
          <span className="flex size-full items-center justify-center bg-linear-to-b from-brand-500 to-brand-700 text-white/90">
            <CatalogIcon name={data.professionIcon} size={88} strokeWidth={1.1} />
          </span>
        )}

        {/* تدرّج بلون السطح أعلى الصورة: أيقونات شريط الحالة تبقى مقروءة فوق أي صورة — داكنة على فاتح نهارًا، فاتحة على داكن ليلًا */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-surface/70 to-transparent"
          aria-hidden="true"
        />

        {data.gallery.length > 0 && (
          <button
            type="button"
            onClick={() => setTab('gallery')}
            className="pressable absolute bottom-9 start-3 inline-flex items-center gap-1 rounded-pill bg-black/60 px-3 py-1 text-badge font-semibold text-white backdrop-blur-sm"
          >
            <ImageIcon size={14} aria-hidden="true" />
            <span className="num">{formatNumber(data.gallery.length)} صورة</span>
          </button>
        )}
      </div>

      {/* ---- المحتوى: لوح أبيض يعلو الغلاف بحافة مستديرة ---- */}
      <div className="relative mx-auto -mt-6 max-w-[520px] rounded-t-[1.5rem] bg-surface">
      {/* الحشو السفلي يعادل ارتفاع فوتر الإجراءات الثابت — بدونه يغطّي آخر المحتوى */}
      <PageContainer className="flex flex-col gap-4 pb-32" withBottomNav={false}>
        {/* ---- الهوية ---- */}
        <header className="flex flex-col gap-3">
          <MediaThumb
            url={data.avatar}
            alt={data.displayName}
            size={84}
            iconName={data.professionIcon}
            rounded="full"
            className="-mt-11 ring-4 ring-surface"
          />

          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-1.5 text-[1.375rem] font-extrabold leading-tight text-ink-900">
              {data.displayName}
              {data.isVerifiedBadge && (
                <BadgeCheck
                  size={22}
                  className="fill-brand-600 text-white"
                  role="img"
                  aria-label="موثّق"
                />
              )}
            </h1>
            <p className="flex flex-wrap items-center gap-x-1.5 text-body text-ink-600">
              {data.professionName && <span>{data.professionName}</span>}
              {data.professionName && data.area && <span aria-hidden="true">·</span>}
              {data.area && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin size={15} className="text-ink-400" aria-hidden="true" />
                  {data.area}
                </span>
              )}
            </p>
          </div>

          {/* ---- الأرقام التي يقرّر بها العميل — في سطر واحد ---- */}
          <dl className="grid grid-cols-3 rounded-card border border-border py-3">
            <StatCell
              label="التقييم"
              value={
                data.ratingCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Star size={16} className="fill-star text-star" aria-hidden="true" />
                    {formatRating(data.ratingAvg)}
                  </span>
                ) : (
                  'جديد'
                )
              }
            />
            <StatCell label="مراجعة" value={formatNumber(reviewsCount)} />
            {data.yearsOfExperience != null ? (
              <StatCell label="سنة خبرة" value={formatNumber(data.yearsOfExperience)} />
            ) : (
              <StatCell label="خدمة" value={formatNumber(data.servicesCount)} />
            )}
          </dl>

          {data.categoryName && data.categorySlug && (
            <Link
              href={`/categories/${data.categorySlug}`}
              className="pressable inline-flex w-fit items-center gap-0.5 rounded-pill bg-bg px-3 py-1.5 text-badge font-semibold text-ink-600"
            >
              {data.categoryName}
              <ChevronLeft size={14} aria-hidden="true" />
            </Link>
          )}
        </header>

        {/* ---- معلومات هامة — إخلاء مسؤولية المنصة (بلون محايد لا ينافس الهوية) ---- */}
        <div className="flex flex-col gap-2 rounded-card bg-bg p-4">
          <h2 className="flex items-center gap-2 text-label font-bold text-ink-900">
            <Gavel size={18} className="text-brand-600" aria-hidden="true" />
            معلومات هامة
          </h2>
          <ul className="flex list-inside list-disc flex-col gap-1 text-meta text-ink-600">
            <li>البيانات مقدمة من مقدم الخدمة. نحن وسيط إعلانات فقط.</li>
            <li>نحن غير مسؤولين عن جودة الخدمة. يتم الاتفاق مباشرة مع مقدم الخدمة.</li>
            <li>السعر والدفع يتم الاتفاق عليهما مباشرة بينك وبين مقدم الخدمة.</li>
          </ul>
        </div>

        {/* ---- التبويبات — تلتصق تحت الشريط العلوي أثناء التمرير ---- */}
        <ProfileTabs
          className="sticky top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-20 -mx-page bg-surface px-page"
          tabs={[
            { key: 'about', label: 'نبذة' },
            { key: 'services', label: 'الخدمات', count: data.servicesCount },
            {
              key: 'gallery',
              label: 'سابقة الأعمال',
              count: data.gallery.length + data.videos.length,
            },
            { key: 'reviews', label: 'التقييمات', count: reviewsTotal },
          ]}
          active={tab}
          onChange={setTab}
        />

        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'about' && (
            <div className="flex flex-col gap-3">
              <p className="text-body text-ink-700">{data.bio}</p>

              <div>
                <h2 className="mb-2 text-label font-bold text-ink-900">مناطق التغطية</h2>
                <div className="flex flex-wrap gap-2">
                  {data.coverageAreas.map((area) => (
                    <Chip key={area} icon={<MapPin size={14} />}>
                      {area}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'services' &&
            (services.isPending ? (
              <Skeleton className="h-40 w-full rounded-card" />
            ) : serviceItems.length === 0 ? (
              <EmptyState message="لا توجد خدمات معروضة" compact />
            ) : (
              <div className="flex flex-col gap-3">
                {serviceItems.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            ))}

          {tab === 'gallery' &&
            (data.gallery.length === 0 && data.videos.length === 0 ? (
              <EmptyState message="لا توجد أعمال سابقة بعد" compact />
            ) : (
              <div className="flex flex-col gap-3">
                {data.videos.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {data.videos.map((url) => (
                      <video
                        key={url}
                        src={url}
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full rounded-field bg-black"
                      />
                    ))}
                  </div>
                )}

                {data.gallery.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {data.gallery.map((url) => (
                      <MediaThumb
                        key={url}
                        url={url}
                        alt={`صورة من أعمال ${data.displayName}`}
                        size={104}
                        rounded="field"
                        className="w-full"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

          {tab === 'reviews' &&
            (reviews.isPending ? (
              <Skeleton className="h-32 w-full rounded-card" />
            ) : reviews.isError ? (
              <ErrorState onRetry={() => void reviews.refetch()} />
            ) : reviewItems.length === 0 ? (
              <EmptyState message="لا توجد تقييمات بعد" compact />
            ) : (
              <ul className="flex flex-col gap-3">
                {reviewItems.map((review) => (
                  <li key={review.id}>
                    <Card>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-label font-bold text-ink-900">
                          {review.customerName}
                        </span>
                        <span className="text-meta text-ink-400">
                          {formatRelativeTime(review.createdAt)}
                        </span>
                      </div>
                      <Rating value={review.rating} compact={false} className="mt-1" />
                      {review.comment && (
                        <p className="mt-2 text-meta text-ink-600">{review.comment}</p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            ))}
        </div>

        {me.data && !isOwnProfile && <ReportProvider providerId={id} />}
      </PageContainer>
      </div>

      {/* ---- فوتر التواصل الثابت ---- */}
      <div className="sticky bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur-sm">
        {isOwnProfile ? (
          <div className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-3 px-page py-3 pb-safe">
            <span className="text-meta text-ink-600">هذا ملفك الشخصي — لا يمكنك التواصل مع نفسك.</span>
            <LinkButton href="/provider/profile" size="sm">
              تعديل الملف
            </LinkButton>
          </div>
        ) : me.data ? (
          <div className="mx-auto flex w-full max-w-[520px] items-center gap-3 px-page py-3 pb-safe">
            <Button
              size="lg"
              className="flex-1"
              loading={contactPending === 'call'}
              disabled={contactPending !== null}
              onClick={() => void openContact('call')}
              iconStart={<Phone size={20} />}
            >
              اتصل الآن
            </Button>
            <Button
              size="lg"
              variant="success"
              className="flex-1"
              loading={contactPending === 'whatsapp'}
              disabled={contactPending !== null}
              onClick={() => void openContact('whatsapp')}
              iconStart={<MessageCircle size={20} />}
            >
              واتساب
            </Button>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[520px] flex-col gap-2 px-page py-3 pb-safe">
            <LinkButton href="/login" size="lg" fullWidth iconStart={<Phone size={20} />}>
              سجّل الدخول للتواصل
            </LinkButton>
          </div>
        )}
        {contactError && (
          <p className="mx-auto max-w-[520px] px-page pb-2 text-center text-badge text-danger" role="alert">
            {contactError}
          </p>
        )}
      </div>
    </>
  );
}

/* ---- عناصر داخلية ---- */

/** خانة رقم في صف الإحصاءات — الرقم كبير والوصف تحته. */
function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse items-center gap-0.5 border-border px-1 text-center [&:not(:first-child)]:border-s">
      <dt className="text-badge text-ink-400">{label}</dt>
      <dd className="num text-section font-extrabold text-ink-900">{value}</dd>
    </div>
  );
}

/** بنفس هيكل الصفحة الحقيقية (غلاف · صورة دائرية · اسم · أرقام) كي لا يقفز شيء عند الوصول. */
function ProfileSkeleton() {
  return (
    <>
      <BackHeader />
      <Skeleton className="mx-auto h-[calc(15rem+env(safe-area-inset-top,0px))] max-w-[520px] rounded-none" />
      <PageContainer className="flex flex-col gap-3" withBottomNav={false}>
        <Skeleton className="-mt-11 size-[84px] rounded-full ring-4 ring-surface" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-[4.5rem] w-full rounded-card" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-10 w-full" />
      </PageContainer>
    </>
  );
}
