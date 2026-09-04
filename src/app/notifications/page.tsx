'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  Bell,
  BellRing,
  CheckCheck,
  ClipboardList,
  MessageSquare,
  Star,
  Tag,
  XCircle,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Chip } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { formatRelativeTime } from '@/lib/format';
import { useNotifications, useReadAllNotifications, useReadNotification } from '@/lib/queries/account';
import {
  NOTIFICATION_TABS,
  NOTIFICATION_TAB_LABELS_AR,
  type NotificationTab,
} from '@/shared/constants/notifications';
import { cn } from '@/lib/cn';
import type { NotificationDto } from '@/server/services/account.service';

/**
 * الإشعارات — الصورة 15.
 *
 * تبويبات بعدّادات · تجميع زمني (اليوم/أمس/هذا الأسبوع/أقدم) · أيقونة
 * ملوّنة بحسب النوع · خلفية خفيفة لغير المقروء · رابط إجراء.
 */
export default function NotificationsPage() {
  const [tab, setTab] = useState<NotificationTab>('ALL');

  const query = useNotifications(tab);
  const readOne = useReadNotification();
  const readAll = useReadAllNotifications();

  const items = query.data?.items ?? [];
  const counts = query.data?.counts ?? {};
  const unreadTotal = query.data?.unreadTotal ?? 0;

  const groups = groupByDay(items);

  return (
    <>
      <AppHeader notificationCount={unreadTotal} />

      <PageContainer className="flex flex-col gap-4">
        <PageTitle title="الإشعارات" subtitle="كل ما يخصّ طلباتك وحسابك" />

        <div className="flex items-center justify-between gap-2">
          <div className="scroll-x flex gap-2 pb-1">
            {NOTIFICATION_TABS.map((entry) => (
              <Chip
                key={entry}
                selected={tab === entry}
                onClick={() => setTab(entry)}
                count={counts[entry] ?? 0}
              >
                {NOTIFICATION_TAB_LABELS_AR[entry]}
              </Chip>
            ))}
          </div>
        </div>

        {unreadTotal > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            loading={readAll.isPending}
            onClick={() => void readAll.mutateAsync()}
            iconStart={<CheckCheck size={16} />}
          >
            تعليم الكل كمقروء
          </Button>
        )}

        {query.isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-card" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell size={44} strokeWidth={1.5} />}
            message="لا توجد إشعارات أخرى"
            description="سنخطرك هنا بكل جديد يخصّ طلباتك."
          />
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h2 className="mb-2 text-meta font-bold text-ink-400">{group.label}</h2>
                <ul className="flex flex-col gap-2">
                  {group.items.map((notification) => (
                    <li key={notification.id}>
                      <NotificationRow
                        notification={notification}
                        onRead={() => {
                          if (!notification.isRead) void readOne.mutateAsync(notification.id);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PageContainer>

      <BottomNav badges={{ notifications: unreadTotal }} />
    </>
  );
}

/* ---- عناصر داخلية ---- */

/** أيقونة ولون لكل نوع — الصورة 15 تعرض أيقونة ملوّنة بحسب النوع. */
const TYPE_STYLE: Record<string, { icon: React.ReactNode; tone: string }> = {
  ORDER_CREATED: { icon: <ClipboardList size={18} />, tone: 'bg-brand-50 text-brand-600' },
  ORDER_ACCEPTED: { icon: <BadgeCheck size={18} />, tone: 'bg-success-bg text-success' },
  ORDER_REJECTED: { icon: <XCircle size={18} />, tone: 'bg-danger-bg text-danger' },
  ORDER_STATUS_CHANGED: { icon: <BellRing size={18} />, tone: 'bg-warning-bg text-warning' },
  ORDER_COMPLETED: { icon: <BadgeCheck size={18} />, tone: 'bg-success-bg text-success' },
  ORDER_CANCELLED: { icon: <XCircle size={18} />, tone: 'bg-danger-bg text-danger' },
  REVIEW_RECEIVED: { icon: <Star size={18} />, tone: 'bg-warning-bg text-star' },
  REVIEW_REMINDER: { icon: <Star size={18} />, tone: 'bg-warning-bg text-star' },
  MESSAGE_RECEIVED: { icon: <MessageSquare size={18} />, tone: 'bg-purple-bg text-purple' },
  PROMOTION: { icon: <Tag size={18} />, tone: 'bg-brand-50 text-brand-600' },
  PROVIDER_APPROVED: { icon: <BadgeCheck size={18} />, tone: 'bg-success-bg text-success' },
  PROVIDER_REJECTED: { icon: <XCircle size={18} />, tone: 'bg-danger-bg text-danger' },
};

const DEFAULT_STYLE = { icon: <Bell size={18} />, tone: 'bg-bg text-ink-600' };

function NotificationRow({
  notification,
  onRead,
}: {
  notification: NotificationDto;
  onRead: () => void;
}) {
  const style = TYPE_STYLE[notification.type] ?? DEFAULT_STYLE;

  const content = (
    <div
      className={cn(
        'flex gap-3 rounded-card border p-3 transition-colors',
        notification.isRead ? 'border-border bg-surface' : 'border-brand-100 bg-brand-50/50'
      )}
    >
      <span
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', style.tone)}
        aria-hidden="true"
      >
        {style.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-label font-bold text-ink-900">{notification.title}</h3>
          {!notification.isRead && (
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-danger"
              aria-label="غير مقروء"
            />
          )}
        </div>

        <p className="line-clamp-2 text-meta text-ink-600">{notification.body}</p>

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="num text-badge text-ink-400">
            {formatRelativeTime(notification.createdAt)}
          </span>
          {notification.actionUrl && (
            <span className="text-badge font-semibold text-brand-600">عرض التفاصيل</span>
          )}
        </div>
      </div>
    </div>
  );

  if (notification.actionUrl) {
    return (
      <Link href={notification.actionUrl} onClick={onRead} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onRead} className="block w-full text-start">
      {content}
    </button>
  );
}

/**
 * تجميع زمني — الصورة 15 تعرض «اليوم / أمس / هذا الأسبوع».
 * دالة خالصة تعمل على القائمة المرتَّبة من الخادم بلا إعادة ترتيب.
 */
function groupByDay(items: NotificationDto[]): { label: string; items: NotificationDto[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const buckets: Record<string, NotificationDto[]> = {
    اليوم: [],
    أمس: [],
    'هذا الأسبوع': [],
    أقدم: [],
  };

  for (const item of items) {
    const time = new Date(item.createdAt).getTime();
    if (time >= startOfToday) buckets['اليوم']!.push(item);
    else if (time >= startOfYesterday) buckets['أمس']!.push(item);
    else if (time >= startOfWeek) buckets['هذا الأسبوع']!.push(item);
    else buckets['أقدم']!.push(item);
  }

  return Object.entries(buckets)
    .filter(([, group]) => group.length > 0)
    .map(([label, group]) => ({ label, items: group }));
}
