'use client';

import Link from 'next/link';
import { Bell, MapPin } from 'lucide-react';
import { NotificationDot } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/queries/auth';
import { useUnreadCounts } from '@/lib/queries/account';
import { useHideOnScroll } from '@/lib/use-hide-on-scroll';
import { useHydrated } from '@/lib/use-hydrated';
import { GOVERNORATE } from '@/shared/constants/fayoum-areas';

/**
 * ترويسة الرئيسية — تحية باسم المستخدم بدل العلامة، كتطبيقات التوصيل
 * والخدمات الكبرى: الشاشة الأولى تخاطب صاحبها، والعلامة موجودة أصلًا في
 * أيقونة التطبيق وشاشة البداية.
 *
 * التحية ثابتة لا تتبع الوقت («صباح الخير»): الصفحة تُرسم على الخادم أولًا
 * بتوقيته، فتحية مبنية على الساعة تختلف بين الخادم والهاتف وتكسر الترطيب.
 */
export function HomeHeader({ notificationsHref }: { notificationsHref: string }) {
  const { data: user } = useMe();
  const unread = useUnreadCounts(Boolean(user));
  const hidden = useHideOnScroll();
  // الخادم لا يعرف المستخدم، فالاسم والعدّاد بعد الترطيب فقط — وإلا اختلف النص
  const hydrated = useHydrated();

  const firstName = hydrated ? user?.fullName.trim().split(/\s+/)[0] : undefined;
  const count = hydrated ? (unread.data?.notifications ?? 0) : 0;

  return (
    <header
      style={{ viewTransitionName: 'app-header' }}
      className={cn(
        'sticky top-0 z-30 border-b border-border bg-surface/90 pt-safe backdrop-blur-md',
        'transition-[translate] duration-300 ease-out',
        hidden && '-translate-y-full'
      )}
    >
      <div className="mx-auto flex max-w-[520px] items-end justify-between gap-3 px-page pb-3 pt-1">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-meta font-semibold text-ink-600">
            <MapPin size={15} className="text-brand-600" aria-hidden="true" />
            {GOVERNORATE}
          </span>
          <h1 className="line-clamp-1 text-[1.375rem] font-extrabold leading-tight text-ink-900">
            {firstName ? `أهلًا، ${firstName}` : 'أهلًا بك'}
          </h1>
        </div>

        <Link
          href={notificationsHref}
          aria-label={count ? `الإشعارات، ${count} غير مقروء` : 'الإشعارات'}
          className="pressable relative flex size-11 shrink-0 items-center justify-center rounded-full bg-bg text-ink-900"
        >
          <Bell size={22} />
          <NotificationDot count={count} />
        </Link>
      </div>
    </header>
  );
}
