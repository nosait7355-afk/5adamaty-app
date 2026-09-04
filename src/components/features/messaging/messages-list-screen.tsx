'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { formatOrderNumber, formatRelativeTime } from '@/lib/format';
import { useThreads } from '@/lib/queries/account';
import { cn } from '@/lib/cn';

/**
 * الرسائل — شاشة مشتقّة مبرَّرة (`UI_ANALYSIS §0.1`): تبويب «الرسائل» في
 * شريط المزوّد وأزرار «تواصل مع العميل» / «محادثة مع مقدم الخدمة».
 *
 * كل محادثة مرتبطة بطلب، فالقائمة تعرض رقم الطلب لا أسماء مجرّدة.
 *
 * مكوّن مشترك: الطرفان يريان نفس المحادثات بنفس الـAPI، ولا يختلفان إلا
 * في شريط التنقّل السفلي — ففصلهما في صفحتين كان سيكرّر الشاشة بلا داعٍ.
 */
export interface MessagesListScreenProps {
  /** شريط التنقّل يختلف بين العميل والمزوّد — المحتوى نفسه لا يختلف. */
  variant?: 'customer' | 'provider';
}

export function MessagesListScreen({ variant = 'customer' }: MessagesListScreenProps) {
  const threads = useThreads();

  const items = threads.data?.items ?? [];
  const unreadTotal = threads.data?.unreadTotal ?? 0;

  return (
    <>
      <AppHeader />

      <PageContainer className="flex flex-col gap-4">
        <PageTitle title="الرسائل" subtitle="محادثاتك حول الطلبات" />

        {threads.isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-card" />
            ))}
          </div>
        ) : threads.isError ? (
          <ErrorState onRetry={() => void threads.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={44} strokeWidth={1.5} />}
            message="لا توجد محادثات"
            description="تُفتح المحادثة بعد قبول مقدم الخدمة لطلبك."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((thread) => (
              <li key={thread.id}>
                <Link href={`/messages/${thread.id}`}>
                  <Card
                    className={cn(
                      'flex items-center gap-3 transition-colors',
                      thread.unread > 0 && 'border-brand-100 bg-brand-50/40'
                    )}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <MessageSquare size={20} aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="line-clamp-1 text-label font-bold text-ink-900">
                          {thread.counterpart.fullName}
                        </h3>
                        {thread.lastMessageAt && (
                          <span className="num shrink-0 text-badge text-ink-400">
                            {formatRelativeTime(thread.lastMessageAt)}
                          </span>
                        )}
                      </div>

                      {thread.orderNumber != null && (
                        <p className="num text-badge text-brand-600">
                          {formatOrderNumber(thread.orderNumber)}
                        </p>
                      )}

                      <p className="line-clamp-1 text-meta text-ink-600">
                        {thread.lastMessagePreview ?? 'ابدأ المحادثة'}
                      </p>
                    </div>

                    {thread.unread > 0 && (
                      <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-danger text-badge font-bold text-white">
                        {thread.unread}
                      </span>
                    )}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageContainer>

      <BottomNav variant={variant} badges={{ messages: unreadTotal }} />
    </>
  );
}
