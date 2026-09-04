import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
}

/** عنصر هيكلي أثناء التحميل. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton rounded-field', className)} />;
}

/**
 * هيكل بطاقة الخدمة — بنفس أبعاد `ServiceCard` الحقيقية (الصورة 09)
 * لتفادي Layout Shift عند وصول البيانات.
 */
export function ServiceCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="flex gap-3">
        <Skeleton className="size-[120px] shrink-0" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-16 rounded-pill" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/** هيكل بطاقة مقدم الخدمة المصغّرة (carousel الصورة 06). */
export function ProviderMiniCardSkeleton() {
  return (
    <div className="flex w-[172px] shrink-0 flex-col items-center gap-2 rounded-card border border-border bg-surface p-4 shadow-card">
      <Skeleton className="size-[72px] rounded-full" />
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-5 w-20 rounded-pill" />
    </div>
  );
}

/** هيكل بطاقة التصنيف (شبكة الصورة 08). */
export function CategoryCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-card border border-border bg-surface p-3 shadow-card">
      <Skeleton className="size-16 rounded-full" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-1 h-3 w-12" />
    </div>
  );
}

/** هيكل بطاقة الطلب (الصورة 13). */
export function OrderCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-pill" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="mt-3 flex gap-3">
        <Skeleton className="size-20 shrink-0" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/** قائمة هياكل. */
export function SkeletonList({
  count = 3,
  Item = ServiceCardSkeleton,
}: {
  count?: number;
  Item?: () => React.JSX.Element;
}) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="جاري التحميل">
      {Array.from({ length: count }, (_, index) => (
        <Item key={index} />
      ))}
    </div>
  );
}
