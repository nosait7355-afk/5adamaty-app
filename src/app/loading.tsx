import { ServiceCardSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * حالة التحميل الفورية لكل الصفحات.
 *
 * كل الصفحات ديناميكية (nonce الـCSP)، فالتنقّل يحتاج رحلة للخادم قبل أن
 * تظهر الصفحة الجديدة. Next.js يجلب هذا الهيكل مسبقًا مع الروابط الظاهرة،
 * فيظهر **لحظة الضغط** بدل أن تتجمّد الشاشة القديمة حتى يردّ الخادم — وهو
 * الفرق الأوضح في الإحساس بين موقع وتطبيق.
 *
 * عام عمدًا: لا يعرف أي صفحة قادمة، فيرسم هيكلًا محايدًا (ترويسة · عنوان ·
 * بطاقات) ومكانًا فارغًا لشريط التنقّل كي لا يقفز المحتوى حين يظهر.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="جارٍ التحميل" aria-busy="true">
      {/* نفس أسماء الترويسة والشريط الحقيقيين — يبقيان ثابتين حين تصل الصفحة */}
      <div
        style={{ viewTransitionName: 'app-header' }}
        className="sticky top-0 z-30 border-b border-border bg-surface/95 px-page pb-3 pt-safe"
      >
        <div className="mx-auto flex h-11 max-w-[520px] items-center justify-between">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-5 w-28" />
          <span className="size-10" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 px-page pt-5">
        <Skeleton className="mx-auto mb-2 h-8 w-40" />
        <ServiceCardSkeleton />
        <ServiceCardSkeleton />
        <ServiceCardSkeleton />
      </div>

      <div
        style={{ viewTransitionName: 'bottom-nav' }}
        className="h-nav-safe fixed inset-x-0 bottom-0 border-t border-border bg-surface/95"
      />
    </div>
  );
}
