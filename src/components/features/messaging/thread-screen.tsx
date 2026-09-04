'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Send } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer } from '@/components/layout/page-container';
import { Button, LinkButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ApiClientError } from '@/lib/api-client';
import { formatOrderNumber, formatTime } from '@/lib/format';
import { useSendMessage, useThreadMessages } from '@/lib/queries/account';
import { cn } from '@/lib/cn';

/**
 * المحادثة — شاشة مشتقّة مبرَّرة (`UI_ANALYSIS §0.1`).
 *
 * تحديث بالاستقصاء الدوري لا اتصال دائم: المحادثة قصيرة وتشغيلية حول طلب،
 * والاستقصاء كل 15 ثانية يكفيها ويتجنّب تعقيد اتصال مفتوح على استضافة
 * serverless.
 */
export interface ThreadScreenProps {
  threadId: string;
}

export function ThreadScreen({ threadId: id }: ThreadScreenProps) {

  const thread = useThreadMessages(id);
  const send = useSendMessage();

  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const messages = thread.data?.items ?? [];

  /*
   * التمرير لآخر رسالة عند وصول رسائل جديدة — أثر على الـDOM لا على الحالة.
   *
   * العدّاد في `ref` لا في `state`: الاستقصاء يعيد مصفوفة جديدة كل 15
   * ثانية، فلولا المقارنة بالعدد لتمرّرت الشاشة بلا سبب — ووضعه في الحالة
   * كان سيسبّب دورة رسم إضافية بلا فائدة.
   */
  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const submit = async () => {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;

    setError('');
    try {
      await send.mutateAsync({ threadId: id, body: trimmed });
      setBody('');
    } catch (sendError) {
      setError(
        sendError instanceof ApiClientError ? sendError.message : 'تعذّر إرسال الرسالة.'
      );
    }
  };

  if (thread.isPending) {
    return (
      <>
        <BackHeader />
        <PageContainer className="flex flex-col gap-3 pt-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-2/3 rounded-card" />
          ))}
        </PageContainer>
      </>
    );
  }

  if (thread.isError || !thread.data) {
    return (
      <>
        <BackHeader />
        <PageContainer className="pt-6">
          <ErrorState
            message="تعذّر فتح المحادثة"
            description="ربما لم تعد متاحة أو لا تخصّ حسابك."
            onRetry={() => void thread.refetch()}
          />
          <LinkButton href="/messages" variant="secondary" fullWidth className="mt-4">
            العودة إلى الرسائل
          </LinkButton>
        </PageContainer>
      </>
    );
  }

  const info = thread.data.thread;

  return (
    <>
      <BackHeader />

      <PageContainer withBottomNav={false} className="flex min-h-[calc(100dvh-90px)] flex-col pt-3">
        {/* ---- ترويسة المحادثة ---- */}
        <header className="flex items-center justify-between gap-2 border-b border-border pb-3">
          <div className="min-w-0">
            <h1 className="line-clamp-1 text-card-title font-bold text-ink-900">
              {info.counterpart.fullName}
            </h1>
            {info.orderNumber != null && (
              <Link
                href={`/orders/${info.orderId}`}
                className="num text-meta font-semibold text-brand-600"
              >
                {formatOrderNumber(info.orderNumber)}
              </Link>
            )}
          </div>
        </header>

        {/* ---- الرسائل ---- */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-4">
          {messages.length === 0 ? (
            <EmptyState message="ابدأ المحادثة" description="اكتب أول رسالة لتنسيق تفاصيل الطلب." />
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex', message.isMine ? 'justify-start' : 'justify-end')}
              >
                <div
                  className={cn(
                    'max-w-[78%] rounded-card px-3 py-2',
                    message.isMine
                      ? 'bg-brand-600 text-white'
                      : 'border border-border bg-surface text-ink-900'
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-meta leading-6">
                    {message.body}
                  </p>
                  <span
                    className={cn(
                      'num mt-1 block text-[10px]',
                      message.isMine ? 'text-white/70' : 'text-ink-400'
                    )}
                  >
                    {formatTime(message.createdAt)}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <InfoAlert tone="danger" title="تعذّر الإرسال" className="mb-2">
            {error}
          </InfoAlert>
        )}

        {/* ---- صندوق الإرسال ---- */}
        <form
          className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-surface py-3 pb-safe"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="اكتب رسالتك…"
            maxLength={2000}
            aria-label="نص الرسالة"
          />
          <Button
            type="submit"
            size="md"
            className="shrink-0 px-4"
            loading={send.isPending}
            disabled={body.trim().length === 0}
            aria-label="إرسال"
          >
            <Send size={18} />
          </Button>
        </form>
      </PageContainer>
    </>
  );
}
