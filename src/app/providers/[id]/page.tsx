'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarDays,
  ChevronLeft,
  Gavel,
  Heart,
  ImageIcon,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldCheck,
  Star,
  Wrench,
} from 'lucide-react';
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
import {
  formatDateShort,
  formatExperience,
  formatNumber,
  formatRating,
  formatRelativeTime,
} from '@/lib/format';
import { useProvider, useProviderReviews, useServices } from '@/lib/queries/discovery';
import { useMe } from '@/lib/queries/auth';
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
  const heroImage = cloudinaryUrl(data.gallery[0], { width: 520, height: 240 });

  return (
    <>
      <BackHeader />

      {/* الحشو السفلي يعادل ارتفاع فوتر الإجراءات الثابت — بدونه يغطّي آخر المحتوى */}
      <PageContainer className="flex flex-col gap-4 pb-32 pt-3" withBottomNav={false}>
        {/* ---- مسار التنقّل ---- */}
        <nav aria-label="مسار التنقّل" className="flex items-center gap-1 text-meta text-ink-400">
          <Link href="/categories" className="hover:text-brand-600">
            التصنيفات
          </Link>
          <ChevronLeft size={14} aria-hidden="true" />
          {data.categorySlug ? (
            <Link href={`/categories/${data.categorySlug}`} className="hover:text-brand-600">
              {data.categoryName}
            </Link>
          ) : (
            <span>{data.categoryName}</span>
          )}
          <ChevronLeft size={14} aria-hidden="true" />
          <span className="line-clamp-1 text-ink-600">{data.displayName}</span>
        </nav>

        {/* ---- صورة كبيرة + عدّاد الصور + إجراءات ---- */}
        <div className="relative h-[200px] overflow-hidden rounded-card bg-brand-50">
          {heroImage ? (
            <Image
              src={heroImage}
              alt={data.displayName}
              fill
              sizes="(max-width: 520px) 100vw, 520px"
              priority
              className="object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-brand-600">
              <CatalogIcon name={data.professionIcon} size={72} strokeWidth={1.25} />
            </span>
          )}

          <div className="absolute end-3 top-3 flex gap-2">
            <ProfileIconButton label="مشاركة الملف" icon={<Share2 size={18} />} />
            <ProfileIconButton label="إضافة إلى المفضلة" icon={<Heart size={18} />} />
          </div>

          {data.gallery.length > 0 && (
            <span className="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-pill bg-ink-900/70 px-3 py-1 text-badge font-semibold text-white">
              <ImageIcon size={14} aria-hidden="true" />
              <span className="num">{formatNumber(data.gallery.length)} صورة</span>
            </span>
          )}
        </div>

        {/* ---- الهوية ---- */}
        <header className="flex flex-col gap-2">
          <h1 className="flex flex-wrap items-center gap-2 text-section font-extrabold text-ink-900">
            {data.displayName}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-600">
            <Rating value={data.ratingAvg} count={data.ratingCount} />
            {data.area && (
              <span className="inline-flex items-center gap-1 text-ink-400">
                <MapPin size={15} aria-hidden="true" />
                {data.area}
              </span>
            )}
            {data.yearsOfExperience != null && (
              <span className="num inline-flex items-center gap-1 text-ink-400">
                <ShieldCheck size={15} className="text-success" aria-hidden="true" />
                {formatExperience(data.yearsOfExperience)}
              </span>
            )}
          </div>

          {data.professionName && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-brand-50 px-3 py-1 text-badge font-semibold text-brand-600">
              <CatalogIcon name={data.professionIcon} size={14} />
              {data.professionName}
            </span>
          )}
        </header>

        {/* ---- الإحصاءات ---- */}
        <Card className="grid grid-cols-3 divide-x divide-x-reverse divide-border p-0">
          <StatCell
            icon={<CalendarDays size={18} />}
            label="عضو منذ"
            value={data.memberSince ? formatDateShort(data.memberSince).split(' ').slice(-1)[0] ?? '—' : '—'}
          />
          <StatCell
            icon={<Star size={18} />}
            label="التقييم"
            value={data.ratingCount > 0 ? formatRating(data.ratingAvg) : '—'}
          />
          <StatCell
            icon={<Wrench size={18} />}
            label="الخدمات"
            value={formatNumber(data.servicesCount)}
          />
        </Card>

        {/* ---- معلومات هامة — إخلاء مسؤولية المنصة ---- */}
        <Card className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-label font-bold text-ink-900">
            <Gavel size={18} className="text-brand-600" aria-hidden="true" />
            معلومات هامة
          </h2>
          <ul className="flex list-inside list-disc flex-col gap-1 text-meta text-ink-600">
            <li>البيانات مقدمة من مقدم الخدمة. نحن وسيط إعلانات فقط.</li>
            <li>نحن غير مسؤولين عن جودة الخدمة. يتم الاتفاق مباشرة مع مقدم الخدمة.</li>
            <li>السعر والدفع يتم الاتفاق عليهما مباشرة بينك وبين مقدم الخدمة.</li>
          </ul>
        </Card>

        {/* ---- التبويبات ---- */}
        <ProfileTabs
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
                        className="w-full rounded-field bg-ink-900"
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

function ProfileIconButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-full bg-surface/90 text-ink-600 shadow-card transition-colors hover:text-brand-600"
    >
      {icon}
    </button>
  );
}

function StatCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-3 text-center">
      <span className="text-brand-600" aria-hidden="true">
        {icon}
      </span>
      <span className="num text-label font-extrabold text-ink-900">{value}</span>
      <span className="text-badge text-ink-400">{label}</span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <BackHeader />
      <PageContainer className="flex flex-col gap-4 pt-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[200px] w-full rounded-card" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full rounded-card" />
      </PageContainer>
    </>
  );
}
